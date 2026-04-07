import { useState, useRef, useCallback } from 'react';
import type { SimState, PackConfig, EcmConfig, BatteryDataPoint, SimMode, SimStats } from '../types';
import { simStep } from '../simulation/simStep';
import { getNextCurrent, type CurrentParams } from '../simulation/currentControl';
import { T_REF, C_MAX_POS, C_MAX_NEG, X_POS_0, X_POS_100, X_NEG_0, X_NEG_100 } from '../simulation/constants';

function makeState(soc0: number, t0_C: number): SimState {
  const soc = Math.max(0.05, Math.min(1.0, soc0));
  const xp0 = X_POS_0 + (X_POS_100 - X_POS_0) * soc;
  const xn0 = X_NEG_0 + (X_NEG_100 - X_NEG_0) * soc;
  return {
    t: 0,
    soc,
    soc0: soc,
    c_avg_pos: C_MAX_POS * xp0,
    c_avg_neg: C_MAX_NEG * xn0,
    V_RC: 0,
    V_RC2: 0,
    T_K: t0_C + 273.15,
    ah: 0,
    wh_out: 0,
    wh_in: 0,
  };
}

export function useBatterySim() {
  const [data, setData] = useState<BatteryDataPoint[]>([]);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [status, setStatus] = useState('Waiting for inputs.');
  const [stats, setStats] = useState<SimStats>({ min_v: 99, max_T: T_REF, max_eta: 0, max_vsag: 0 });

  const stateRef = useRef<SimState>(makeState(1.0, 25));
  const dataRef = useRef<BatteryDataPoint[]>([]);
  const animRef = useRef<number | null>(null);
  const paramsRef = useRef<CurrentParams | null>(null);
  const statsRef = useRef<SimStats>({ min_v: 99, max_T: T_REF, max_eta: 0, max_vsag: 0 });
  const packRef = useRef<PackConfig | null>(null);
  const ecmRef = useRef<EcmConfig | null>(null);
  const limitsRef = useRef({ oc_limit: 250, t_limit: 60 });

  const finish = useCallback((msg: string) => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    animRef.current = null;
    setRunning(false);
    setPaused(false);
    setStatus(msg + ` Data: ${dataRef.current.length} points.`);
    setData([...dataRef.current]);
    setStats({ ...statsRef.current });
  }, []);

  const start = useCallback((
    pack: PackConfig,
    ecm: EcmConfig,
    mode: SimMode,
    soc0_pct: number,
    t0_C: number,
    currentParams: Omit<CurrentParams, 'cv_t_start'>,
    limits: { oc_limit: number; t_limit: number },
  ) => {
    if (mode === 'charge' && soc0_pct >= 99) {
      setStatus('Set initial SOC < 100% for charging.');
      return;
    }

    const state = makeState(soc0_pct / 100, t0_C);
    stateRef.current = state;
    dataRef.current = [];
    statsRef.current = { min_v: 99, max_T: T_REF, max_eta: 0, max_vsag: 0 };
    packRef.current = pack;
    ecmRef.current = ecm;
    paramsRef.current = { ...currentParams, cv_t_start: null };
    limitsRef.current = limits;

    setRunning(true);
    setPaused(false);
    setStatus('Simulation running...');

    const dt = 0.1;
    const stepsPerFrame = 50;

    function loop() {
      const p = packRef.current!;
      const e = ecmRef.current!;
      const params = paramsRef.current!;
      let st = stateRef.current;
      let lastPoint: BatteryDataPoint | null = null;

      for (let k = 0; k < stepsPerFrame; k++) {
        const lastVt = dataRef.current.length > 0
          ? dataRef.current[dataRef.current.length - 1].v_t
          : p.v_nom;

        const result = getNextCurrent(st.t, lastVt, params, p);
        paramsRef.current = { ...params, cv_t_start: result.cv_t_start };

        if (result.done) {
          const label = params.mode === 'charge' ? 'Charging complete.'
            : params.mode === 'profile' ? 'Profile completed.'
            : `Done \u2014 ${st.t.toFixed(0)}s simulated.`;
          stateRef.current = st;
          finish(label);
          return;
        }

        const stepResult = simStep(st, p, e, result.i, dt);
        st = stepResult.state;
        lastPoint = stepResult.point;

        // Update stats
        const s = statsRef.current;
        if (lastPoint.v_t < s.min_v) s.min_v = lastPoint.v_t;
        if (st.T_K > s.max_T) s.max_T = st.T_K;
        const eta_tot = Math.abs(lastPoint.eta_pos / 1000) + Math.abs(lastPoint.eta_neg / 1000);
        if (eta_tot > s.max_eta) s.max_eta = eta_tot;
        const vsag = lastPoint.v_oc - lastPoint.v_t;
        if (vsag > s.max_vsag) s.max_vsag = vsag;

        // Store data point (resolution ~0.1s)
        if (dataRef.current.length === 0 || st.t - dataRef.current[dataRef.current.length - 1].t >= 0.09) {
          dataRef.current.push(lastPoint);
        }

        // Stop conditions
        if (result.i > 0 && st.soc <= 0.01) {
          stateRef.current = st;
          finish('Battery empty \u2014 SOC \u2264 1%.');
          return;
        }
        if (result.i < 0 && st.soc >= 0.999) {
          stateRef.current = st;
          finish('Battery full \u2014 SOC 100%.');
          return;
        }
        if (lastPoint.v_t < p.v_min - 2) {
          stateRef.current = st;
          finish('Stopped \u2014 terminal voltage too low.');
          return;
        }
        if (lastPoint.v_t > p.v_max + 1) {
          stateRef.current = st;
          finish('Stopped \u2014 overvoltage during charging.');
          return;
        }
        if (lastPoint.T_C > limitsRef.current.t_limit) {
          stateRef.current = st;
          finish(`Stopped \u2014 overtemperature ${lastPoint.T_C.toFixed(1)}\u00b0C > ${limitsRef.current.t_limit}\u00b0C.`);
          return;
        }
      }

      stateRef.current = st;
      setData([...dataRef.current]);
      setStats({ ...statsRef.current });
      animRef.current = requestAnimationFrame(loop);
    }

    animRef.current = requestAnimationFrame(loop);
  }, [finish]);

  const pause = useCallback(() => {
    if (!running) return;
    if (!paused) {
      setPaused(true);
      if (animRef.current) cancelAnimationFrame(animRef.current);
      animRef.current = null;
      setStatus(`Paused \u2014 ${stateRef.current.t.toFixed(1)}s. Data: ${dataRef.current.length} points.`);
      setData([...dataRef.current]);
    } else {
      setPaused(false);
      setStatus('Simulation running...');
      const dt = 0.1;
      const stepsPerFrame = 50;

      function loop() {
        const p = packRef.current!;
        const e = ecmRef.current!;
        const params = paramsRef.current!;
        let st = stateRef.current;

        for (let k = 0; k < stepsPerFrame; k++) {
          const lastVt = dataRef.current.length > 0
            ? dataRef.current[dataRef.current.length - 1].v_t
            : p.v_nom;

          const result = getNextCurrent(st.t, lastVt, params, p);
          paramsRef.current = { ...params, cv_t_start: result.cv_t_start };

          if (result.done) {
            stateRef.current = st;
            finish('Done.');
            return;
          }

          const stepResult = simStep(st, p, e, result.i, dt);
          st = stepResult.state;

          const s = statsRef.current;
          if (stepResult.point.v_t < s.min_v) s.min_v = stepResult.point.v_t;
          if (st.T_K > s.max_T) s.max_T = st.T_K;

          if (dataRef.current.length === 0 || st.t - dataRef.current[dataRef.current.length - 1].t >= 0.09) {
            dataRef.current.push(stepResult.point);
          }

          if (result.i > 0 && st.soc <= 0.01) { stateRef.current = st; finish('Battery empty.'); return; }
          if (stepResult.point.v_t < p.v_min - 2) { stateRef.current = st; finish('Undervoltage.'); return; }
          if (stepResult.point.T_C > limitsRef.current.t_limit) { stateRef.current = st; finish('Overtemperature.'); return; }
        }

        stateRef.current = st;
        setData([...dataRef.current]);
        setStats({ ...statsRef.current });
        animRef.current = requestAnimationFrame(loop);
      }

      animRef.current = requestAnimationFrame(loop);
    }
  }, [running, paused, finish]);

  const reset = useCallback(() => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    animRef.current = null;
    stateRef.current = makeState(1.0, 25);
    dataRef.current = [];
    statsRef.current = { min_v: 99, max_T: T_REF, max_eta: 0, max_vsag: 0 };
    setData([]);
    setRunning(false);
    setPaused(false);
    setStatus('Reset.');
    setStats({ min_v: 99, max_T: T_REF, max_eta: 0, max_vsag: 0 });
  }, []);

  return {
    data,
    running,
    paused,
    status,
    stats,
    simState: stateRef.current,
    start,
    pause,
    reset,
  };
}
