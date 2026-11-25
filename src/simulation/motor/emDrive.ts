/**
 * Loss-based model of the hybrid electric drive: 2 × self-made VESC-based ESC
 * + 2 × Neumotors 6530/8.5/104 + 3:1 planetary in the front hubs.
 *
 * Replaces the constant 0.85 / 0.75 efficiencies of the endurance simulator.
 * Per motor, at wheel force share F and speed v:
 *   motor torque  T_m = F·r / (gear·η_gear)       (motoring; ×η_gear² on regen)
 *   phase current I   = T_m / Kt
 *   copper loss       = I²·R_w·(1 + 0.00393·(T_wind − 25))
 *   iron/friction     = I0(V)·V_bemf, I0(V) = I0_10V·√(V_bemf/10 V)
 *   ESC loss          = I²·R_esc + k_sw·V_dc·|I| + P_fixed
 *   P_elec            = P_mech + all losses        (P_mech < 0 on regen)
 *
 * Limits (HSF 2026, Tables 5.1 and 6.2):
 *   motor 7.5 Nm max, 85 A peak/nominal, 3.5 kW cont / 7 kW peak
 *   Neumotors 65xx datasheet (2023-10), row 6530/8.5/104: Kt 92.0 mNm/A,
 *   Rm 0.086 Ω (terminal), Io 0.577 A @ 10 V, 85 A saturation, 115 V,
 *   12 000 rpm; continuous rating = housing below 100 °C, winding max 180 °C.
 *   ESC 86 A cont, 100 A for 5 s, 6.88 kW cont, 8 kW for 5 s, passive cooling,
 *   mounted in the side floors out of the airflow
 * Thermal derating follows the VESC firmware defaults (linear current
 * cut-back between start and end temperature, 85 → 100 °C).
 *
 * The ESC loss terms and all thermal values are ESTIMATES (R_esc from
 * FDD86367-F085, 4.2 mΩ max, 4 in parallel per switch, plus shunt and PCB). A dyno
 * run (efficiency map) and a 10 min constant-torque run with a thermocouple
 * on the stator and on the ESC FETs would replace them.
 */
import { kVtoKt, kVradFromKv } from './motorConstants';

export interface EmDriveParams {
  n: number;               // motors
  kV: number;              // RPM/V
  gear: number;            // motor → wheel
  eta_gear: number;        // planetary, per direction
  T_motor_max_Nm: number;  // datasheet 7.5 Nm
  I_motor_max_A: number;   // datasheet 85 A (VESC 'motor current max')
  /** Saturation current [A]; above it each extra amp gives k_sat of the torque */
  I_sat_A: number;
  k_sat: number;
  I_esc_cont_A: number;    // HSF 86 A
  I_esc_peak_A: number;    // HSF 100 A …
  esc_peak_s: number;      // … for 5 s
  P_esc_cont_W: number;    // HSF 6.88 kW
  P_esc_peak_W: number;    // HSF 8 kW for 5 s
  R_w_Ohm: number;         // terminal resistance at 25 °C (datasheet Rm)
  I0_A: number;            // no-load current at 10 V (datasheet Io)
  R_esc_Ohm: number;       // estimate, FET + shunt conduction
  k_sw: number;            // estimate, switching loss [W/(V·A)]
  P_esc_fixed_W: number;   // estimate, gate drive + MCU
  // Thermal (per motor / per ESC)
  C_wind_JK: number;
  R_wind_case_KW: number;
  C_case_JK: number;
  G_case_amb0_WK: number;
  G_case_amb_kv: number;   // × v^0.8 (wheel airflow)
  C_esc_JK: number;
  G_esc_amb_WK: number;
  T_motor_derate_C: [number, number];
  T_esc_derate_C: [number, number];
}

export function defaultEmDrive(): EmDriveParams {
  return {
    n: 2,
    kV: 104,
    gear: 3.0,
    eta_gear: 0.97,
    T_motor_max_Nm: 7.5,     // HSF; 85 A saturation × Kt = 7.8 Nm
    I_motor_max_A: 85,
    I_sat_A: 85,             // datasheet 'Saturation Amps'
    k_sat: 0.5,              // estimate: torque per amp halves beyond saturation
    I_esc_cont_A: 86,
    I_esc_peak_A: 100,
    esc_peak_s: 5,
    P_esc_cont_W: 6880,
    P_esc_peak_W: 8000,
    R_w_Ohm: 0.086,
    I0_A: 0.577,
    R_esc_Ohm: 0.0035,
    k_sw: 0.0015,
    P_esc_fixed_W: 3,
    C_wind_JK: 120,
    R_wind_case_KW: 0.15,
    C_case_JK: 450,
    G_case_amb0_WK: 1.2,
    G_case_amb_kv: 0.25,
    C_esc_JK: 150,
    G_esc_amb_WK: 1.3,
    T_motor_derate_C: [85, 100],
    T_esc_derate_C: [85, 100],
  };
}

export interface EmThermalState {
  T_wind_C: number;
  T_case_C: number;
  T_esc_C: number;
  esc_peak_t: number;   // time spent above the ESC continuous current [s]
}

export function initEmThermal(T0: number): EmThermalState {
  return { T_wind_C: T0, T_case_C: T0, T_esc_C: T0, esc_peak_t: 0 };
}

function ramp(T: number, [a, b]: [number, number]): number {
  if (T <= a) return 1;
  if (T >= b) return 0;
  return 1 - (T - a) / (b - a);
}

/** Current derating factor 0…1 from winding and ESC temperature (VESC-style). */
export function emDerate(p: EmDriveParams, st: EmThermalState): number {
  return Math.min(ramp(st.T_wind_C, p.T_motor_derate_C), ramp(st.T_esc_C, p.T_esc_derate_C));
}

/** Motor torque [Nm] from phase current, with saturation above I_sat. */
export function torqueFromCurrent(p: EmDriveParams, I: number): number {
  const Kt = kVtoKt(p.kV);
  const a = Math.abs(I);
  const T = a <= p.I_sat_A ? Kt * a : Kt * (p.I_sat_A + p.k_sat * (a - p.I_sat_A));
  return Math.sign(I) * T;
}

/** Phase current [A] needed for motor torque T (inverse of torqueFromCurrent). */
export function currentFromTorque(p: EmDriveParams, T: number): number {
  const Kt = kVtoKt(p.kV);
  const a = Math.abs(T) / Kt;
  return a <= p.I_sat_A ? a : p.I_sat_A + (a - p.I_sat_A) / p.k_sat;
}

/** Phase-current limit per motor [A] at the present state. */
export function emCurrentLimit(p: EmDriveParams, st: EmThermalState): number {
  const esc = st.esc_peak_t < p.esc_peak_s ? p.I_esc_peak_A : p.I_esc_cont_A;
  return Math.min(currentFromTorque(p, p.T_motor_max_Nm), p.I_motor_max_A, esc) * emDerate(p, st);
}

/**
 * Maximum total wheel force of the hub motors [N] (motoring), from the
 * current limit, field weakening near no-load speed and the ESC power limit.
 */
export function emMaxWheelForce(
  p: EmDriveParams, v: number, V_dc: number, wheel_r: number, I_lim: number, peak: boolean,
): number {
  const w_m = Math.max(0.1, v) / wheel_r * p.gear;
  const rpm_m = w_m * 60 / (2 * Math.PI);
  const rpm_nl = p.kV * V_dc;
  const fw = Math.max(0, Math.min(1, (rpm_nl - rpm_m) / (0.2 * rpm_nl)));
  const T_m = torqueFromCurrent(p, I_lim) * fw;
  // ESC electrical power limit → mechanical (rough: 90 % drive efficiency)
  const P_esc = peak ? p.P_esc_peak_W : p.P_esc_cont_W;
  const T_P = 0.9 * P_esc / w_m;
  return p.n * Math.min(T_m, T_P) * p.gear * p.eta_gear / wheel_r;
}

export interface EmOperatingPoint {
  P_elec_W: number;     // total, > 0 from the HSC
  I_phase_A: number;    // per motor
  P_loss_motor_W: number; // per motor
  P_loss_esc_W: number;   // per ESC
  eta: number;          // |P_mech/P_elec| motoring, |P_elec/P_mech| regen
}

/**
 * Electrical power for a total wheel force F (> 0 drive, < 0 regen) at speed v.
 */
export function emOperatingPoint(
  p: EmDriveParams, F_wheel: number, v: number, V_dc: number, wheel_r: number, T_wind_C = 25,
): EmOperatingPoint {
  if (F_wheel === 0) return { P_elec_W: 0, I_phase_A: 0, P_loss_motor_W: 0, P_loss_esc_W: 0, eta: 0 };
  const w_m = Math.max(0.1, v) / wheel_r * p.gear;
  const T_wheel_each = F_wheel * wheel_r / p.n;
  const T_m = F_wheel > 0
    ? T_wheel_each / (p.gear * p.eta_gear)
    : T_wheel_each * p.eta_gear / p.gear;
  const I = currentFromTorque(p, T_m);
  const V_bemf = w_m / kVradFromKv(p.kV);
  const P_cu = I * I * p.R_w_Ohm * (1 + 0.00393 * (T_wind_C - 25));
  const P_fe = p.I0_A * Math.sqrt(Math.max(0, V_bemf) / 10) * V_bemf;
  const P_m_loss = P_cu + P_fe;
  const P_e_loss = I * I * p.R_esc_Ohm + p.k_sw * V_dc * I + p.P_esc_fixed_W;
  const P_mech_m = T_m * w_m;
  const P_elec_each = P_mech_m + P_m_loss + P_e_loss;
  const P_wheel = F_wheel * Math.max(0.1, v);
  const P_elec = p.n * P_elec_each;
  const eta = F_wheel > 0
    ? (P_elec > 0 ? P_wheel / P_elec : 0)
    : (P_elec < 0 ? P_elec / P_wheel : 0);
  return { P_elec_W: P_elec, I_phase_A: I, P_loss_motor_W: P_m_loss, P_loss_esc_W: P_e_loss, eta };
}

/** Advance motor (winding + case) and ESC temperatures. */
export function stepEmThermal(
  p: EmDriveParams, st: EmThermalState, op: EmOperatingPoint,
  v: number, T_amb: number, dt: number, I_esc_cont = p.I_esc_cont_A,
): EmThermalState {
  const G_ca = p.G_case_amb0_WK + p.G_case_amb_kv * Math.pow(Math.max(0, v), 0.8);
  const n = Math.max(1, Math.ceil(dt / (0.3 * p.C_wind_JK * p.R_wind_case_KW)));
  const h = dt / n;
  let { T_wind_C: Tw, T_case_C: Tc, T_esc_C: Te } = st;
  for (let i = 0; i < n; i++) {
    const q_wc = (Tw - Tc) / p.R_wind_case_KW;
    Tw += (op.P_loss_motor_W - q_wc) / p.C_wind_JK * h;
    Tc += (q_wc - G_ca * (Tc - T_amb)) / p.C_case_JK * h;
    Te += (op.P_loss_esc_W - p.G_esc_amb_WK * (Te - T_amb)) / p.C_esc_JK * h;
  }
  const esc_peak_t = op.I_phase_A > I_esc_cont ? st.esc_peak_t + dt : Math.max(0, st.esc_peak_t - dt);
  return { T_wind_C: Tw, T_case_C: Tc, T_esc_C: Te, esc_peak_t };
}
