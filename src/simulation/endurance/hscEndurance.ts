/**
 * FSG endurance + acceleration simulation for the M06H hybrid with the HSC
 * cell model (cellModel.ts), the concept thermal model (hscThermal.ts) and the
 * BMS limits (bms.ts, FSG T11.7.7).
 *
 * Endurance — quasi-steady-state lap simulation on a distance grid:
 *   1. corner speed limit from tyre grip (+ optional downforce)
 *   2. forward pass: full-throttle acceleration with
 *        ICE on the rear axle (torque curve, best gear, rear grip with weight transfer)
 *        2 hub motors on the front axle (current/power limit, field weakening at
 *        the actual pack voltage, front grip, HSC discharge-current limit)
 *      combined with lateral grip use (friction ellipse)
 *   3. backward pass: braking limit
 *   4. along the final speed trace: EM boost on acceleration, regen on braking
 *      (front brake share, charge-current limit, 4.45 V/cell), ICE the rest
 * The battery and thermal model are then integrated in time along the lap,
 * including a stationary driver change. The EM deployment factor k (0–1) is
 * either set by hand or found automatically so that the HSC ends the event
 * at the target SOC — the way a team would tune its energy strategy.
 *
 * Acceleration — 75 m from standstill, time-domain with dt = 2 ms.
 */
import { interpICETorque } from '../motor/iceEngine';
import {
  type EmDriveParams, type EmThermalState, type EmOperatingPoint,
  defaultEmDrive, initEmThermal, emCurrentLimit, emMaxWheelForce, emOperatingPoint, stepEmThermal,
} from '../motor/emDrive';
import {
  type PackModelConfig, type PackState,
  initPackState, evalPack, stepPack, currentForPower, cellsHeatCapacity,
} from '../cellModel';
import {
  type HscThermalParams, type HscThermalState,
  initThermal, stepHscThermal, hottestCellC, meanCellC,
} from '../hscThermal';
import { bmsCheck, defaultBmsLimits, BMS_TIMERS_ZERO, type BmsLimits, type BmsTimers } from '../bms';
import { type TrackSegment, discretise, FSG_LIKE_LAP } from './track';

const G = 9.81;
const RHO = 1.2;

// ── Inputs ────────────────────────────────────────────────────────────────

export interface HybridVehicleParams {
  mass_kg: number;
  CdA_m2: number;
  ClA_m2: number;          // downforce coefficient × area (0 = no aero)
  aero_front: number;      // fraction of downforce on the front axle
  Crr: number;
  mu: number;              // tyre friction coefficient
  grip_usage: number;      // fraction of mu the driver uses in endurance (0.8–0.95)
  h_cg_m: number;
  wheelbase_m: number;
  f_front: number;         // static front weight fraction
  wheel_r_m: number;
  // ICE + gearbox (rear)
  ice_primary: number;
  ice_gears: number[];
  ice_final: number;
  eta_ice_drive: number;
  ice_rpm_max: number;
  ice_rpm_launch: number;  // clutch-slip launch rpm
  bsfc_gkWh: number;
  // Hub motors + ESCs (front), loss and thermal model
  em: EmDriveParams;
  brake_front_share: number;
}

/** M06H defaults (HybridTab values + Yamaha CP2 gearbox). */
export function defaultVehicle(): HybridVehicleParams {
  return {
    mass_kg: 285,
    CdA_m2: 0.98,
    ClA_m2: 0,
    aero_front: 0.45,
    Crr: 0.018,
    mu: 1.6,
    grip_usage: 0.85,
    h_cg_m: 0.32,
    wheelbase_m: 1.55,
    f_front: 0.39,
    wheel_r_m: 0.206,
    ice_primary: 1.925,
    ice_gears: [2.846, 2.125, 1.632, 1.300, 1.091, 0.964],
    ice_final: 1.733,
    eta_ice_drive: 0.90,
    ice_rpm_max: 10500,
    ice_rpm_launch: 6000,
    bsfc_gkWh: 300,
    em: defaultEmDrive(),
    brake_front_share: 0.65,
  };
}

export interface HscStrategy {
  deploy: 'auto' | 'manual';
  k_manual: number;        // EM deployment factor 0…1 for 'manual'
  soc_target_end: number;  // 0…1, for 'auto'
  regen: boolean;
  /** Pack discharge current the ESCs are limited to [A] (≤ 2 × 99 A) */
  I_dis_limit_A: number;
  /** Pack regen current the ESCs are limited to [A] (≤ 2 × 26.4 A continuous) */
  I_chg_limit_A: number;
  /** Through-the-road charging power at steady speed [kW], 0 = off */
  ttr_kW: number;
  /** ESC derates so the weakest cell stays above this [V] */
  v_cell_floor: number;
  /** ESC derates regen so the highest cell stays below this [V] */
  v_cell_ceiling: number;
  /**
   * No regen while the hottest cell is above this [°C]. The datasheet allows
   * charging only at 0…45 °C and the BMS opens the AIR on any charge current
   * above that, so the ESC must stop regen a little before 45 °C.
   */
  regen_T_max_C: number;
}

export function defaultStrategy(): HscStrategy {
  return {
    deploy: 'auto',
    k_manual: 1,
    soc_target_end: 0.15,
    regen: true,
    I_dis_limit_A: 198,
    I_chg_limit_A: 52.8,
    ttr_kW: 0,
    v_cell_floor: 3.0,
    v_cell_ceiling: 4.40,
    regen_T_max_C: 43,
  };
}

export interface EnduranceSetup {
  track: TrackSegment[];
  n_laps: number;
  laps_before_change: number;
  driver_change_s: number;
  soc0: number;
  T_amb_C: number;
  T0_C: number;
  concept: HscThermalParams;
  bms_T_max_C: number;
  ds_m: number;
}

export function defaultSetup(concept: HscThermalParams): EnduranceSetup {
  return {
    track: FSG_LIKE_LAP,
    n_laps: 21,
    laps_before_change: 10,
    driver_change_s: 180,
    soc0: 0.95,
    T_amb_C: 30,
    T0_C: 30,
    concept,
    bms_T_max_C: 58,
    ds_m: 1,
  };
}

// ── Vehicle force model ───────────────────────────────────────────────────

/** Best-gear ICE wheel force [N] at speed v. */
export function iceWheelForce(veh: HybridVehicleParams, v: number): number {
  const w = Math.max(0.1, v) / veh.wheel_r_m;
  let best = 0;
  for (const g of veh.ice_gears) {
    const ratio = veh.ice_primary * g * veh.ice_final;
    const rpm = w * ratio * 60 / (2 * Math.PI);
    if (rpm > veh.ice_rpm_max) continue;
    const T = interpICETorque(Math.max(rpm, veh.ice_rpm_launch));
    best = Math.max(best, T * ratio * veh.eta_ice_drive / veh.wheel_r_m);
  }
  return best;
}

/**
 * Hub-motor wheel force limit [N] at speed v and DC-link voltage V_dc, for a
 * per-motor phase-current limit (default: cold motor, ESC peak allowed).
 */
export function emWheelForce(
  veh: HybridVehicleParams, v: number, V_dc: number,
  I_lim: number = emCurrentLimit(veh.em, initEmThermal(25)), peak = true,
): number {
  return emMaxWheelForce(veh.em, v, V_dc, veh.wheel_r_m, I_lim, peak);
}

/** Scale a wheel force so its electrical power stays within [P_min, P_max]. */
function limitByPower(veh: HybridVehicleParams, F: number, v: number, V_dc: number, P_min: number, P_max: number): number {
  let f = F;
  for (let i = 0; i < 3 && f !== 0; i++) {
    const P = emOperatingPoint(veh.em, f, v, V_dc, veh.wheel_r_m).P_elec_W;
    if (P > P_max && P > 0) f *= P_max / P;
    else if (P < P_min && P < 0) f *= P_min / P;
    else break;
  }
  return f;
}

interface AxleLimits { F_front: number; F_rear: number; fx: number; D: number; Rr: number }

function axleLimits(veh: HybridVehicleParams, v: number, kappa: number, a: number): AxleLimits {
  const W = veh.mass_kg * G;
  const DF = 0.5 * RHO * veh.ClA_m2 * v * v;
  const mu = veh.mu * veh.grip_usage;
  const aLatMax = mu * (W + DF) / veh.mass_kg;
  const aLat = v * v * kappa;
  const fx = Math.sqrt(Math.max(0, 1 - (aLat / aLatMax) ** 2));
  const dN = veh.mass_kg * a * veh.h_cg_m / veh.wheelbase_m;
  const N_f = Math.max(0, W * veh.f_front + DF * veh.aero_front - dN);
  const N_r = Math.max(0, W * (1 - veh.f_front) + DF * (1 - veh.aero_front) + dN);
  return {
    F_front: mu * fx * N_f,
    F_rear: mu * fx * N_r,
    fx,
    D: 0.5 * RHO * veh.CdA_m2 * v * v,
    Rr: veh.Crr * (W + DF),
  };
}

function cornerSpeed(veh: HybridVehicleParams, kappa: number, vmax: number): number {
  if (kappa <= 0) return vmax;
  const mu = veh.mu * veh.grip_usage;
  const den = kappa - mu * RHO * veh.ClA_m2 / (2 * veh.mass_kg);
  if (den <= 0) return vmax;
  return Math.min(vmax, Math.sqrt(mu * G / den));
}

interface TractionResult { a: number; F_ice: number; F_em: number }

function fullThrottle(
  veh: HybridVehicleParams, v: number, kappa: number, k: number,
  V_dc: number, P_em_elec_max: number, a0: number, I_lim: number, peak = true,
): TractionResult {
  let a = a0;
  let F_ice = 0, F_em = 0;
  const F_motor = k > 0 ? emWheelForce(veh, v, V_dc, I_lim, peak) : 0;
  for (let it = 0; it < 3; it++) {
    const L = axleLimits(veh, v, kappa, a);
    F_ice = Math.min(iceWheelForce(veh, v), L.F_rear);
    F_em = k * Math.max(0, Math.min(F_motor, L.F_front));
    if (F_em > 0) F_em = limitByPower(veh, F_em, v, V_dc, -Infinity, P_em_elec_max);
    a = (F_ice + F_em - L.D - L.Rr) / veh.mass_kg;
  }
  return { a, F_ice, F_em };
}

// ── Lap profile ───────────────────────────────────────────────────────────

export interface LapPoint {
  s: number;
  v: number;          // speed at the start of the step [m/s]
  dt: number;         // time to the next point [s]
  vm: number;         // mean speed over the step [m/s]
  F_em_N: number;     // hub-motor wheel force (>0 drive, <0 regen)
  P_elec_W: number;   // HSC electrical power at the planning voltage (>0 discharge)
  P_ice_W: number;    // ICE wheel power
  phase: 'accel' | 'brake' | 'steady';
}

export function lapProfile(
  veh: HybridVehicleParams,
  strat: HscStrategy,
  track: TrackSegment[],
  ds: number,
  k: number,
  V_dc: number,
  v_entry: number | null,
  I_lim: number = emCurrentLimit(veh.em, initEmThermal(25)),
): LapPoint[] {
  const { s, kappa } = discretise(track, ds);
  const n = s.length;
  const vmax = 40;
  const vlim = kappa.map(kp => cornerSpeed(veh, kp, vmax));
  const P_em_elec_max = strat.I_dis_limit_A * V_dc;

  // Forward pass: standing start (v_entry = null) or flying lap from the exit speed
  const vf = new Array<number>(n + 1);
  const Fem = new Array<number>(n).fill(0);
  vf[0] = Math.min(vlim[0], v_entry ?? 0);
  let a_prev = 0;
  for (let i = 0; i < n; i++) {
    const tr = fullThrottle(veh, vf[i], kappa[i], k, V_dc, P_em_elec_max, a_prev, I_lim);
    a_prev = tr.a;
    Fem[i] = tr.F_em;
    const v2 = vf[i] * vf[i] + 2 * Math.max(0, tr.a) * ds;
    vf[i + 1] = Math.min(Math.sqrt(v2), vlim[(i + 1) % n]);
  }
  // Backward pass (braking), wrap: lap end must reach lap start speed
  const vb = new Array<number>(n + 1);
  vb[n] = vf[n];
  for (let i = n - 1; i >= 0; i--) {
    const L = axleLimits(veh, vb[i + 1], kappa[i], 0);
    const mu = veh.mu * veh.grip_usage;
    const DF = 0.5 * RHO * veh.ClA_m2 * vb[i + 1] ** 2;
    const a_b = mu * L.fx * (veh.mass_kg * G + DF) / veh.mass_kg + (L.D + L.Rr) / veh.mass_kg;
    vb[i] = Math.min(vf[i], Math.sqrt(vb[i + 1] ** 2 + 2 * a_b * ds));
  }

  const pts: LapPoint[] = [];
  const P_chg_min = -strat.I_chg_limit_A * V_dc;
  for (let i = 0; i < n; i++) {
    const v0 = vb[i], v1 = vb[i + 1];
    const vm = Math.max(0.5, 0.5 * (v0 + v1));
    const dt = 2 * ds / Math.max(0.5, v0 + v1);
    const a = (v1 * v1 - v0 * v0) / (2 * ds);
    const L = axleLimits(veh, vm, kappa[i], a);
    const F_res = L.D + L.Rr;
    let F_em = 0, P_ice = 0;
    let phase: LapPoint['phase'];
    if (a > 0.05) {
      phase = 'accel';
      const F_tot = veh.mass_kg * a + F_res;
      F_em = Math.min(Fem[i], F_tot);
      P_ice = Math.max(0, F_tot - F_em) * vm;
    } else if (a < -0.05) {
      phase = 'brake';
      const F_brake = veh.mass_kg * -a - F_res;
      if (F_brake > 0 && strat.regen) {
        const F_max = Math.min(F_brake * veh.brake_front_share, emWheelForce(veh, vm, V_dc, I_lim));
        F_em = limitByPower(veh, -F_max, vm, V_dc, P_chg_min, Infinity);
      }
    } else {
      phase = 'steady';
      P_ice = F_res * vm;
      if (strat.ttr_kW > 0) {
        const F_max = Math.min(strat.ttr_kW * 1000 / vm, emWheelForce(veh, vm, V_dc, I_lim));
        F_em = limitByPower(veh, -F_max, vm, V_dc, Math.max(P_chg_min, -strat.ttr_kW * 1000), Infinity);
        P_ice += -F_em * vm;
      }
    }
    const P_elec = emOperatingPoint(veh.em, F_em, vm, V_dc, veh.wheel_r_m).P_elec_W;
    pts.push({ s: s[i], v: v0, vm, dt, F_em_N: F_em, P_elec_W: P_elec, P_ice_W: P_ice, phase });
  }
  return pts;
}

// ── Time integration of HSC along the event ───────────────────────────────

export interface TracePoint {
  t: number;
  lap: number;
  v_kmh: number;
  I: number;
  V_hsc: number;
  V_cell_min: number;
  V_cell_max: number;
  soc: number;          // %
  T_hot: number;
  T_sensor: number;
  T_mean: number;
  T_struct: number;
  T_motor: number;
  T_esc: number;
  P_kW: number;
  Q_W: number;
}

export interface EnduranceResult {
  k: number;
  lap_times_s: number[];
  lap_time_ice_only_s: number;
  total_time_s: number;
  drive_time_s: number;
  I_rms_drive_A: number;
  I_rms_lap_A: number[];
  I_peak_A: number;
  I_regen_peak_A: number;
  Wh_out: number;
  Wh_regen: number;
  fuel_g: number;
  soc_end: number;
  soc_min: number;
  /** Hottest cell core */
  T_hot_max_C: number;
  /** Hottest cell surface/tab — what the BMS sensor reads */
  T_sensor_max_C: number;
  T_mean_end_C: number;
  T_struct_max_C: number;
  V_cell_min: number;
  V_cell_max: number;
  V_hsc_max: number;
  Q_cells_avg_W: number;
  bms_trip: string | null;
  bms_trip_t_s: number | null;
  bms_trip_lap: number | null;
  derate_time_s: number;
  /** Hub-motor winding / ESC peak temperatures [°C] */
  T_motor_max_C: number;
  T_esc_max_C: number;
  /** Time the motors/ESCs ran thermally derated [s] */
  em_derate_time_s: number;
  I_phase_peak_A: number;
  /** Mean battery→wheel efficiency while driving, wheel→battery while regenerating */
  eta_drive_avg: number;
  eta_regen_avg: number;
  trace: TracePoint[];
  lap_speed: { s: number; v_kmh: number; P_kW: number }[];
}

function limitCurrent(
  st: PackState, cfg: PackModelConfig, strat: HscStrategy, I_req: number, T_C: number,
): { I: number; derated: boolean } {
  let I = Math.max(-strat.I_chg_limit_A, Math.min(strat.I_dis_limit_A, I_req));
  let derated = I !== I_req;
  if (I > 0) {
    const e = evalPack(st, cfg, I, T_C);
    if (e.V_cell_min < strat.v_cell_floor) {
      // linear in I: V_min(I) = V_min(0) − I·R → solve for the floor
      const e0 = evalPack(st, cfg, 0, T_C);
      const R = (e0.V_cell_min - e.V_cell_min) / I;
      I = Math.max(0, (e0.V_cell_min - strat.v_cell_floor) / Math.max(1e-9, R));
      derated = true;
    }
  } else if (I < 0) {
    const e = evalPack(st, cfg, I, T_C);
    if (e.V_cell_max > strat.v_cell_ceiling) {
      const e0 = evalPack(st, cfg, 0, T_C);
      const R = (e.V_cell_max - e0.V_cell_max) / -I;
      I = -Math.max(0, (strat.v_cell_ceiling - e0.V_cell_max) / Math.max(1e-9, R));
      derated = true;
    }
  }
  return { I, derated };
}

function simulateEvent(
  veh: HybridVehicleParams,
  strat: HscStrategy,
  pack: PackModelConfig,
  setup: EnduranceSetup,
  k: number,
  record: boolean,
): EnduranceResult {
  const S = pack.series;
  const nCells = pack.series * pack.parallel;
  const C_cells = cellsHeatCapacity(pack);
  const lim: BmsLimits = defaultBmsLimits(pack.parallel, setup.bms_T_max_C);
  const fanHsc = setup.concept.UA_fan_WK > 0;

  let ps = initPackState(setup.soc0);
  let th: HscThermalState = initThermal(setup.T0_C);
  let timers: BmsTimers = { ...BMS_TIMERS_ZERO };
  let live = true;
  let trip: string | null = null, tripT: number | null = null, tripLap: number | null = null;

  let t = 0, drive_t = 0, I2 = 0, Ipk = 0, Irg = 0, whOut = 0, whIn = 0, fuel = 0, Qsum = 0;
  let socMin = setup.soc0, Thmax = setup.T0_C, Tsensmax = setup.T0_C, Tsmax = setup.T0_C;
  let Vmin = 9, Vmax = 0, Vhscmax = 0, derate = 0;
  let em: EmThermalState = initEmThermal(setup.T_amb_C);
  let Tmmax = setup.T_amb_C, Temax = setup.T_amb_C, emDer = 0, Iph = 0;
  let Ewheel_d = 0, Eel_d = 0, Ewheel_r = 0, Eel_r = 0;
  const lapTimes: number[] = [];
  const IrmsLap: number[] = [];
  const trace: TracePoint[] = [];
  let lastRec = -1;
  let v_entry: number | null = null;
  let lapSpeed: EnduranceResult['lap_speed'] = [];

  const rec = (lap: number, v: number, I: number, e: ReturnType<typeof evalPack>, P: number, Q: number) => {
    if (!record || t - lastRec < 0.5) return;
    lastRec = t;
    trace.push({
      t, lap, v_kmh: v * 3.6, I, V_hsc: e.V_hsc, V_cell_min: e.V_cell_min, V_cell_max: e.V_cell_max,
      soc: ps.soc * 100, T_hot: hottestCellC(th), T_sensor: th.T_hot_C,
      T_mean: meanCellC(th, setup.concept), T_struct: th.T_struct_C,
      T_motor: em.T_wind_C, T_esc: em.T_esc_C, P_kW: P / 1000, Q_W: Q,
    });
  };

  for (let lap = 1; lap <= setup.n_laps; lap++) {
    const Tm = meanCellC(th, setup.concept);
    const V_dc = evalPack(ps, pack, 100, Tm).V_esc;
    // Plan the lap with the drive's current limit at lap start (thermal derating)
    const prof = lapProfile(veh, strat, setup.track, setup.ds_m, live ? k : 0, V_dc, v_entry,
      emCurrentLimit(veh.em, em));
    v_entry = prof[prof.length - 1].v;
    if (lap === 2 && record) {
      lapSpeed = prof.filter((_, i) => i % 2 === 0).map(p => ({ s: p.s, v_kmh: p.v * 3.6, P_kW: p.P_elec_W / 1000 }));
    }
    let lapT = 0, lapI2 = 0;
    for (const p of prof) {
      const dt = p.dt;
      const T_mean = meanCellC(th, setup.concept);
      let I = 0;
      let op: EmOperatingPoint = { P_elec_W: 0, I_phase_A: 0, P_loss_motor_W: 0, P_loss_esc_W: 0, eta: 0 };
      const regenBlocked = p.F_em_N < 0 && th.T_hot_C > strat.regen_T_max_C;
      if (live && p.F_em_N !== 0 && !regenBlocked) {
        // Re-check the motor/ESC limit at the present temperature
        const V_now = evalPack(ps, pack, 0, T_mean).V_esc;
        const I_lim = emCurrentLimit(veh.em, em);
        const F_cap = emWheelForce(veh, p.vm, V_now, I_lim, em.esc_peak_t < veh.em.esc_peak_s);
        let F = Math.sign(p.F_em_N) * Math.min(Math.abs(p.F_em_N), F_cap);
        if (Math.abs(F) < Math.abs(p.F_em_N) - 1e-6) emDer += dt;
        op = emOperatingPoint(veh.em, F, p.vm, V_now, veh.wheel_r_m, em.T_wind_C, em.T_esc_C);
        const I_req = currentForPower(ps, pack, op.P_elec_W, T_mean);
        const r = limitCurrent(ps, pack, strat, I_req, T_mean);
        I = r.I;
        if (r.derated) {
          derate += dt;
          F *= I_req !== 0 ? I / I_req : 0;
          op = emOperatingPoint(veh.em, F, p.vm, V_now, veh.wheel_r_m, em.T_wind_C, em.T_esc_C);
        }
        const Pw = F * p.vm * dt;
        if (F > 0) { Ewheel_d += Pw; Eel_d += op.P_elec_W * dt; }
        else if (F < 0) { Ewheel_r += -Pw; Eel_r += -op.P_elec_W * dt; }
      }
      em = stepEmThermal(veh.em, em, op, p.vm, setup.T_amb_C, dt);
      Tmmax = Math.max(Tmmax, em.T_wind_C); Temax = Math.max(Temax, em.T_esc_C);
      Iph = Math.max(Iph, op.I_phase_A);
      const e = evalPack(ps, pack, I, T_mean);
      const Q = e.Q_cells_W;
      th = stepHscThermal(th, setup.concept, C_cells, Q, e.Q_hsc_internal_W, setup.T_amb_C, p.v, fanHsc && live, dt, nCells);
      ps = stepPack(ps, pack, I, T_mean, dt);
      // BMS sensor sits on the cell tab/surface (EV5.8.5) → hot-node surface temperature
      const T_hot = th.T_hot_C;

      if (live) {
        const Vcell = I < 0 ? e.V_cell_max : e.V_cell_min;
        const b = bmsCheck(timers, lim, Vcell * S, S, I, T_hot, dt);
        timers = b.timers;
        if (b.trip) { live = false; trip = b.trip; tripT = t; tripLap = lap; }
      }

      t += dt; lapT += dt; drive_t += dt;
      I2 += I * I * dt; lapI2 += I * I * dt;
      Ipk = Math.max(Ipk, I); Irg = Math.max(Irg, -I);
      if (I > 0) whOut += e.V_hsc * I * dt / 3600; else whIn += -e.V_hsc * I * dt / 3600;
      fuel += p.P_ice_W / veh.eta_ice_drive / 1000 * veh.bsfc_gkWh * dt / 3600;
      Qsum += Q * dt;
      socMin = Math.min(socMin, ps.soc);
      Thmax = Math.max(Thmax, hottestCellC(th)); Tsensmax = Math.max(Tsensmax, T_hot); Tsmax = Math.max(Tsmax, th.T_struct_C);
      if (live || I !== 0) {
        Vmin = Math.min(Vmin, e.V_cell_min); Vmax = Math.max(Vmax, e.V_cell_max);
        Vhscmax = Math.max(Vhscmax, e.V_hsc);
      }
      rec(lap, p.v, I, e, I * e.V_hsc, Q);
    }
    lapTimes.push(lapT);
    IrmsLap.push(Math.sqrt(lapI2 / lapT));

    if (lap === setup.laps_before_change && setup.driver_change_s > 0) {
      // Driver change: car stationary, hybrid off (AIR open), fan off
      const steps = Math.ceil(setup.driver_change_s / 1);
      for (let i = 0; i < steps; i++) {
        const dt = setup.driver_change_s / steps;
        th = stepHscThermal(th, setup.concept, C_cells, 0, 0, setup.T_amb_C, 0, false, dt, nCells);
        em = stepEmThermal(veh.em, em, { P_elec_W: 0, I_phase_A: 0, P_loss_motor_W: 0, P_loss_esc_W: 0, eta: 0 }, 0, setup.T_amb_C, dt);
        ps = stepPack(ps, pack, 0, meanCellC(th, setup.concept), dt);
        t += dt;
        rec(lap, 0, 0, evalPack(ps, pack, 0, meanCellC(th, setup.concept)), 0, 0);
      }
      v_entry = null;
    }
  }

  const ice = lapProfile(veh, strat, setup.track, setup.ds_m, 0, 50, null);
  const iceLap = lapProfile(veh, strat, setup.track, setup.ds_m, 0, 50, ice[ice.length - 1].v)
    .reduce((s, p) => s + p.dt, 0);

  return {
    k,
    lap_times_s: lapTimes,
    lap_time_ice_only_s: iceLap,
    total_time_s: t,
    drive_time_s: drive_t,
    I_rms_drive_A: Math.sqrt(I2 / drive_t),
    I_rms_lap_A: IrmsLap,
    I_peak_A: Ipk,
    I_regen_peak_A: Irg,
    Wh_out: whOut,
    Wh_regen: whIn,
    fuel_g: fuel,
    soc_end: ps.soc,
    soc_min: socMin,
    T_hot_max_C: Thmax,
    T_sensor_max_C: Tsensmax,
    T_mean_end_C: meanCellC(th, setup.concept),
    T_struct_max_C: Tsmax,
    V_cell_min: Vmin,
    V_cell_max: Vmax,
    V_hsc_max: Vhscmax,
    Q_cells_avg_W: Qsum / drive_t,
    bms_trip: trip,
    bms_trip_t_s: tripT,
    bms_trip_lap: tripLap,
    derate_time_s: derate,
    T_motor_max_C: Tmmax,
    T_esc_max_C: Temax,
    em_derate_time_s: emDer,
    I_phase_peak_A: Iph,
    eta_drive_avg: Eel_d > 0 ? Ewheel_d / Eel_d : 0,
    eta_regen_avg: Ewheel_r > 0 ? Eel_r / Ewheel_r : 0,
    trace,
    lap_speed: lapSpeed,
  };
}

/**
 * Run the endurance. In 'auto' mode the deployment factor k is bisected so
 * that the HSC ends at soc_target_end (or k = 1 if even full deployment
 * leaves more energy, k = 0 if regen alone cannot reach it).
 */
export function runHscEndurance(
  veh: HybridVehicleParams,
  strat: HscStrategy,
  pack: PackModelConfig,
  setup: EnduranceSetup,
): EnduranceResult {
  if (strat.deploy === 'manual') {
    return simulateEvent(veh, strat, pack, setup, Math.max(0, Math.min(1, strat.k_manual)), true);
  }
  const target = strat.soc_target_end;
  const ok = (r: EnduranceResult) => r.bms_trip === null && r.soc_end >= target;
  const full = simulateEvent(veh, strat, pack, setup, 1, false);
  if (ok(full)) return simulateEvent(veh, strat, pack, setup, 1, true);
  let lo = 0, hi = 1;
  for (let i = 0; i < 14; i++) {
    const mid = 0.5 * (lo + hi);
    const r = simulateEvent(veh, strat, pack, setup, mid, false);
    if (ok(r)) lo = mid; else hi = mid;
  }
  return simulateEvent(veh, strat, pack, setup, lo, true);
}

// ── Acceleration event ────────────────────────────────────────────────────

export interface AccelResult {
  t75_s: number;
  I_phase_peak_A: number;
  t75_ice_only_s: number;
  v75_kmh: number;
  I_peak_A: number;
  V_cell_min: number;
  V_hsc_min: number;
  Wh: number;
  dT_hot_K: number;
  bms_trip: string | null;
  trace: { t: number; v_kmh: number; x: number; I: number; V_cell_min: number; F_em: number; F_ice: number }[];
}

export function runAcceleration(
  veh: HybridVehicleParams,
  strat: HscStrategy,
  pack: PackModelConfig,
  soc0: number,
  T0_C: number,
  concept: HscThermalParams,
  useEm = true,
): AccelResult {
  const dt = 0.002;
  const S = pack.series;
  const nCells = pack.series * pack.parallel;
  const C_cells = cellsHeatCapacity(pack);
  const lim = defaultBmsLimits(pack.parallel);
  const vehL = { ...veh, grip_usage: 1 };
  let ps = initPackState(soc0);
  let th = initThermal(T0_C);
  let timers = { ...BMS_TIMERS_ZERO };
  let v = 0, x = 0, t = 0, a = 0, Ipk = 0, Vmin = 9, Vhmin = 999, wh = 0;
  let trip: string | null = null;
  const trace: AccelResult['trace'] = [];
  let live = useEm;
  let em = initEmThermal(T0_C);
  let Iph = 0;
  while (x < 75 && t < 20) {
    const T_m = meanCellC(th, concept);
    const e0 = evalPack(ps, pack, 0, T_m);
    const tr = fullThrottle(vehL, v, 0, live ? 1 : 0, e0.V_esc, strat.I_dis_limit_A * e0.V_esc, a,
      emCurrentLimit(veh.em, em), em.esc_peak_t < veh.em.esc_peak_s);
    let I = 0;
    let F_em = tr.F_em;
    let op: EmOperatingPoint = { P_elec_W: 0, I_phase_A: 0, P_loss_motor_W: 0, P_loss_esc_W: 0, eta: 0 };
    if (live && F_em > 0) {
      op = emOperatingPoint(veh.em, F_em, v, e0.V_esc, veh.wheel_r_m, em.T_wind_C, em.T_esc_C);
      const I_req = currentForPower(ps, pack, op.P_elec_W, T_m);
      const r = limitCurrent(ps, pack, strat, I_req, T_m);
      I = r.I;
      if (r.derated && I_req > 0) {
        F_em *= I / I_req;
        op = emOperatingPoint(veh.em, F_em, v, e0.V_esc, veh.wheel_r_m, em.T_wind_C, em.T_esc_C);
      }
    }
    em = stepEmThermal(veh.em, em, op, v, T0_C, dt);
    Iph = Math.max(Iph, op.I_phase_A);
    const L = axleLimits(vehL, v, 0, a);
    a = (tr.F_ice + F_em - L.D - L.Rr) / veh.mass_kg;
    const e = evalPack(ps, pack, I, T_m);
    if (live) {
      const b = bmsCheck(timers, lim, e.V_cell_min * S, S, I, th.T_hot_C, dt);
      timers = b.timers;
      if (b.trip) { trip = b.trip; live = false; }
    }
    th = stepHscThermal(th, concept, C_cells, e.Q_cells_W, e.Q_hsc_internal_W, T0_C, v, true, dt, nCells);
    ps = stepPack(ps, pack, I, T_m, dt);
    Ipk = Math.max(Ipk, I);
    if (I > 0) { Vmin = Math.min(Vmin, e.V_cell_min); Vhmin = Math.min(Vhmin, e.V_hsc); }
    wh += I * e.V_hsc * dt / 3600;
    if (Math.round(t / dt) % 10 === 0) {
      trace.push({ t, v_kmh: v * 3.6, x, I, V_cell_min: e.V_cell_min, F_em, F_ice: tr.F_ice });
    }
    v += a * dt; x += v * dt; t += dt;
  }
  const iceOnly = useEm ? runAcceleration(veh, strat, pack, soc0, T0_C, concept, false).t75_s : t;
  return {
    t75_s: t,
    t75_ice_only_s: iceOnly,
    v75_kmh: v * 3.6,
    I_peak_A: Ipk,
    I_phase_peak_A: Iph,
    V_cell_min: Vmin === 9 ? NaN : Vmin,
    V_hsc_min: Vhmin === 999 ? NaN : Vhmin,
    Wh: wh,
    dT_hot_K: th.T_hot_C - T0_C,
    bms_trip: trip,
    trace,
  };
}
