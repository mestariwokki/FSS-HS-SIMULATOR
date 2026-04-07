import { useState, useRef, useCallback } from 'react';
import type { PackConfig, EcmConfig, MotorSimState, MotorDataPoint, MotorMode, MotorProfileStep, MotorSimStats } from '../types';
import { motorStep, type MotorStepConfig } from '../simulation/motor/motorStep';
import { tractionLimit } from '../simulation/motor/traction';
// Motor constants used via MotorStepConfig

function makeMotorState(soc0_pct: number, t0_C: number): MotorSimState {
  return {
    t: 0,
    soc: Math.max(0.05, Math.min(1.0, soc0_pct / 100)),
    ah: 0,
    wh_out: 0,
    wh_regen: 0,
    V_RC: 0,
    V_RC2: 0,
    T_motor_C: t0_C,
    T_esc_C: t0_C,
    v_kmh: 0,
    x_m: 0,
    boost_t: 0,
    trac_ratio: 1.0,
    acc75_done: false,
    t_75: null,
    v_75: null,
    a_prev: 0,
    trac_switch_t: null,
    trac_switch_v: null,
  };
}

export function useMotorSim() {
  const [data, setData] = useState<MotorDataPoint[]>([]);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [status, setStatus] = useState('Ready.');
  const [simStats, setSimStats] = useState<MotorSimStats>({
    max_I_bat: 0, min_Vt: 999, max_T_m: 25, max_T_e: 25,
    eta_sum: 0, eta_n: 0, t_target: null,
  });
  const [acc75Result, setAcc75Result] = useState<{
    t_75: number | null;
    v_75: number | null;
    trac_switch_t: number | null;
    trac_switch_v: number | null;
  } | null>(null);

  const stateRef = useRef<MotorSimState>(makeMotorState(100, 25));
  const dataRef = useRef<MotorDataPoint[]>([]);
  const animRef = useRef<number | null>(null);
  const statsRef = useRef<MotorSimStats>({
    max_I_bat: 0, min_Vt: 999, max_T_m: 25, max_T_e: 25,
    eta_sum: 0, eta_n: 0, t_target: null,
  });

  const finish = useCallback((msg: string) => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    animRef.current = null;
    setRunning(false);
    setPaused(false);
    setStatus(msg);
    setData([...dataRef.current]);
    setSimStats({ ...statsRef.current });
  }, []);

  const start = useCallback((
    pack: PackConfig,
    ecm: EcmConfig,
    mc: MotorStepConfig & {
      v_start: number;
      v_target: number;
      mass: number;
      CdA: number;
      Crr: number;
      mu: number;
      f_front: number;
      h_cg: number;
      wheelbase: number;
      mass_acc: number;
      Crr_acc: number;
      soc_warn: number;
      I_warn: number;
    },
    mode: MotorMode,
    soc0_pct: number,
    t0_C: number,
    duration_s: number,
    profile?: MotorProfileStep[],
    regenParams?: { power_kW: number; speed_kmh: number },
  ) => {
    const state = makeMotorState(soc0_pct, t0_C);
    const dt = mode === 'acc75' ? 0.05 : 0.1;

    if (mode === 'const' || mode === 'acc75') {
      state.v_kmh = mode === 'acc75' ? 0 : mc.v_start;
    }

    stateRef.current = state;
    dataRef.current = [];
    statsRef.current = {
      max_I_bat: 0, min_Vt: 999, max_T_m: t0_C, max_T_e: t0_C,
      eta_sum: 0, eta_n: 0, t_target: null,
    };
    setAcc75Result(null);
    setRunning(true);
    setPaused(false);
    setStatus('Simulating...');

    let profileIdx = 0;
    let elapsed = 0;

    function loop() {
      let st = stateRef.current;
      const isAcc75 = mode === 'acc75';
      const isVakio = mode === 'const';

      // Determine power and speed
      let P_req_kW: number;
      let spd_kmh: number;
      let dur_total = duration_s;

      if (mode === 'profile' && profile && profile.length > 0) {
        while (profileIdx < profile.length && elapsed >= profile[profileIdx].duration_s) {
          elapsed -= profile[profileIdx].duration_s;
          profileIdx++;
        }
        if (profileIdx >= profile.length) {
          finish('Done.');
          return;
        }
        P_req_kW = profile[profileIdx].power_kW;
        spd_kmh = profile[profileIdx].speed_kmh;
        dur_total = profile.reduce((s, r) => s + r.duration_s, 0);
      } else if (mode === 'regen' && regenParams) {
        P_req_kW = -regenParams.power_kW;
        spd_kmh = regenParams.speed_kmh;
      } else if (isAcc75) {
        P_req_kW = 0;
        spd_kmh = st.v_kmh;
        dur_total = 30;
      } else {
        P_req_kW = mc.P_peak * mc.n;
        spd_kmh = st.v_kmh;
      }

      P_req_kW = Math.max(-mc.P_peak * mc.n, Math.min(mc.P_peak * mc.n, P_req_kW));

      if (st.t >= dur_total && mode !== 'profile') {
        finish(isVakio ? `Max duration reached \u2014 ${st.v_kmh.toFixed(1)} km/h` : 'Done.');
        return;
      }

      if (st.T_motor_C > mc.T_amb + 60) { finish(`Motor overtemp ${st.T_motor_C.toFixed(1)}\u00b0C`); return; }
      if (st.T_esc_C > mc.T_amb + 50) { finish(`ESC overtemp ${st.T_esc_C.toFixed(1)}\u00b0C`); return; }
      if (st.soc < 0.02) { finish('Battery empty.'); return; }

      for (let i = 0; i < 5; i++) {
        const stepSpd = (isVakio || isAcc75) ? st.v_kmh : spd_kmh;

        if (isAcc75) {
          const v_ms = Math.max(0.15, st.v_kmh / 3.6);
          const wheel_r = mc.wheel_d_mm / 2000;
          const I_lim = (st.boost_t < 5.0) ? mc.I_peak : mc.I_cont;
          const F_el_torque = I_lim * mc.Kt * mc.gear * 0.97 * mc.n / wheel_r;
          const F_el_power = mc.P_peak * mc.n * 1000 / v_ms;
          const F_el_avail = Math.min(F_el_torque, F_el_power);

          const { F_el_max } = tractionLimit(st.a_prev, mc.mass_acc, mc.mu, mc.f_front, mc.h_cg, mc.wheelbase);
          const F_el_use = Math.min(F_el_avail, F_el_max);

          const F_drag = 0.5 * 1.225 * mc.CdA * v_ms * v_ms;
          const F_roll = mc.Crr_acc * mc.mass_acc * 9.81;
          const a = Math.max(0, F_el_use - F_drag - F_roll) / mc.mass_acc;

          st = {
            ...st,
            a_prev: a,
            trac_ratio: F_el_avail > 0 ? Math.min(1, F_el_use / F_el_avail) : 1.0,
          };

          if (st.trac_ratio >= 0.99 && st.trac_switch_t === null) {
            st = { ...st, trac_switch_t: st.t, trac_switch_v: st.v_kmh };
          }

          st = {
            ...st,
            v_kmh: st.v_kmh + a * dt * 3.6,
            x_m: st.x_m + v_ms * dt + 0.5 * a * dt * dt,
            boost_t: Math.min(5.0, st.boost_t + dt),
          };

          P_req_kW = F_el_use * v_ms / 1000;
        }

        const result = motorStep(P_req_kW, stepSpd, st, pack, ecm, mc, dt);
        st = { ...result.state, t: st.t + dt };
        elapsed += dt;

        if (isVakio) {
          const v_ms = st.v_kmh / 3.6;
          const wheel_rf = mc.wheel_d_mm / 2000;
          const F_trac = result.point.T_wheel * mc.n / wheel_rf;
          const F_drag = 0.5 * 1.225 * mc.CdA * v_ms * v_ms;
          const F_roll = mc.Crr * mc.mass * 9.81;
          const a = Math.max(0, F_trac - F_drag - F_roll) / mc.mass;
          st = { ...st, v_kmh: Math.min(mc.v_target, st.v_kmh + a * dt * 3.6) };
          if (st.v_kmh >= mc.v_target && statsRef.current.t_target === null) {
            statsRef.current.t_target = st.t;
          }
        }

        const point = { ...result.point, t: st.t, v_kmh: st.v_kmh };
        if (isAcc75) {
          point.x_m = st.x_m;
          point.trac_ratio = st.trac_ratio;
        }

        // Update stats
        const stats = statsRef.current;
        if (result.point.I_bat > stats.max_I_bat) stats.max_I_bat = result.point.I_bat;
        if (result.point.V_t < stats.min_Vt) stats.min_Vt = result.point.V_t;
        if (st.T_motor_C > stats.max_T_m) stats.max_T_m = st.T_motor_C;
        if (st.T_esc_C > stats.max_T_e) stats.max_T_e = st.T_esc_C;
        const eta = result.point.eta;
        if (eta > 0) { stats.eta_sum += eta / 100; stats.eta_n++; }

        if (dataRef.current.length < 6000) dataRef.current.push(point);
      }

      stateRef.current = st;

      // 75m check
      if (isAcc75 && st.x_m >= 75 && !st.acc75_done) {
        st = { ...st, acc75_done: true, t_75: st.t, v_75: st.v_kmh };
        stateRef.current = st;
        setAcc75Result({
          t_75: st.t, v_75: st.v_kmh,
          trac_switch_t: st.trac_switch_t, trac_switch_v: st.trac_switch_v,
        });
        finish(`75 m \u2014 ${st.t.toFixed(3)} s | ${st.v_kmh.toFixed(1)} km/h`);
        return;
      }

      if (isVakio && st.v_kmh >= mc.v_target) {
        finish(`${mc.v_target.toFixed(0)} km/h reached \u2014 ${statsRef.current.t_target?.toFixed(2) ?? ''} s`);
        return;
      }

      setData([...dataRef.current]);
      setSimStats({ ...statsRef.current });
      animRef.current = requestAnimationFrame(loop);
    }

    animRef.current = requestAnimationFrame(loop);
  }, [finish]);

  const reset = useCallback(() => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    animRef.current = null;
    stateRef.current = makeMotorState(100, 25);
    dataRef.current = [];
    statsRef.current = {
      max_I_bat: 0, min_Vt: 999, max_T_m: 25, max_T_e: 25,
      eta_sum: 0, eta_n: 0, t_target: null,
    };
    setData([]);
    setRunning(false);
    setPaused(false);
    setStatus('Reset.');
    setSimStats({ ...statsRef.current });
    setAcc75Result(null);
  }, []);

  return {
    data,
    running,
    paused,
    status,
    simStats,
    acc75Result,
    motorState: stateRef.current,
    start,
    pause: () => {
      setPaused(p => !p);
      if (!paused && animRef.current) {
        cancelAnimationFrame(animRef.current);
        animRef.current = null;
        setStatus(`Paused \u2014 ${stateRef.current.t.toFixed(1)}s`);
      }
    },
    reset,
  };
}
