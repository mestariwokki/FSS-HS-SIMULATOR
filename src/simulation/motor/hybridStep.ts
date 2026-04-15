/**
 * Drivetrain architecture:
 *
 * FRONT AXLE — 2× hub motor, direct drive, no gearbox
 *   → EM force limited by front axle normal force N_f
 *   → During acceleration weight shifts rearward → N_f decreases → EM limit tightens
 *   → At low speed EM is dominant (high torque, good front traction utilisation)
 *
 * REAR AXLE — ICE → gearbox → differential
 *   → ICE force limited by rear axle normal force N_r
 *   → During acceleration weight shifts rearward → N_r increases → ICE benefits
 *   → At high speed ICE is dominant
 *
 * Oscillation prevention: weight transfer is calculated with exponentially filtered
 * acceleration (α = 0.12, τ ≈ 0.4 s). Hub motors respond electrically fast,
 * but tyre grip changes mechanically slowly — the slow filter is physically
 * justified, not just a numerical trick.
 */
import { interpICETorque, calcIceFuelStep } from './iceEngine';
import { battery2RCStep, packMaxPowerW } from '../battery';

const ALPHA_WEIGHT = 0.12;  // filter coefficient for weight transfer, τ ≈ dt/α ≈ 0.42 s

// ── Config ────────────────────────────────────────────────────────────────

export interface HybridConfig {
  // Electric motor (front axle, 2× hub motor, combined value)
  P_em_peak_kW: number;   // combined EM peak power
  P_em_cont_kW: number;   // combined EM continuous power
  T_em_peak_Nm: number;   // max wheel torque from EM (at low speeds)
  eta_em: number;         // ESC + winding efficiency (electric→mechanical)
  eta_regen: number;
  em_gear: number;        // EM internal planetary gear (motor shaft → wheel)

  // ICE (rear axle)
  ice_gear: number;       // ICE shaft → wheel gear ratio (incl. final drive)
  bsfc_gkWh: number;      // brake specific fuel consumption [g/kWh]
  ice_start_delay_s: number;
  ice_rpm_min: number;    // below this ICE cannot produce torque

  // Battery — 2RC Thevenin
  pack_series: number;
  pack_parallel: number;
  pack_Q_Ah: number;
  pack_T_celsius: number;

  // Vehicle
  mass_kg: number;
  wheel_r_m: number;
  CdA_m2: number;
  Crr: number;
  mu: number;
  // Vehicle dynamics (weight transfer)
  h_cg_m: number;         // centre of gravity height [m]
  wheelbase_m: number;    // wheelbase [m]
  f_front: number;        // static front axle weight fraction [0–1]
}

// ── State ─────────────────────────────────────────────────────────────────

export interface HybridState {
  t: number;
  v_ms: number;
  x_m: number;
  soc: number;
  wh_em: number;
  wh_mech: number;
  fuel_g: number;
  boost_t: number;
  V_rc1: number;
  V_rc2: number;
  a_smooth: number;   // filtered acceleration for weight transfer [m/s²]
  // Thermal state
  T_bldc_C: number;   // BLDC motor temperature (symmetric for both motors)
  T_esc_C: number;    // ESC temperature (symmetric)
  T_ice_C: number;    // ICE coolant temperature
}

// ── Output point ──────────────────────────────────────────────────────────

export interface HybridPoint {
  t: number;
  v_kmh: number;
  a_ms2: number;
  x_m: number;
  P_demand_kW: number;
  P_em_kW: number;
  P_ice_kW: number;
  P_total_kW: number;
  T_em_Nm: number;
  T_ice_Nm: number;
  T_total_Nm: number;
  RPM_wheel: number;
  RPM_ice: number;
  N_f: number;        // front axle normal force [N]
  N_r: number;        // rear axle normal force [N]
  soc: number;
  I_bat: number;
  V_bat: number;
  V_rc1: number;
  V_rc2: number;
  wh_em: number;
  fuel_g: number;
  wh_mech: number;
  eta_sys: number;
  is_hybrid: boolean;
  // BLDC1/BLDC2 breakdown (symmetric load → I_BLDC1 = I_BLDC2)
  I_BLDC1: number;
  I_BLDC2: number;
  P_BLDC1_kW: number;      // mechanical output power per motor [kW]
  P_BLDC2_kW: number;
  P_elec_BLDC_kW: number; // electrical input power per motor [kW]
  T_BLDC1: number;    // BLDC temperature °C
  T_BLDC2: number;
  T_ESC1: number;     // ESC temperature °C
  T_ESC2: number;
  eta_BLDC1: number;
  eta_BLDC2: number;
  // ICE temperature & efficiency
  T_ice_C: number;
  eta_ice: number;
  // Efficiency map operating points
  RPM_bldc: number;       // BLDC shaft speed (RPM_wheel × gear ratio)
  T_motor_Nm: number;     // BLDC shaft torque per motor [Nm]
  T_ice_shaft_Nm: number; // ICE crankshaft torque [Nm]
}

// ── Step function ─────────────────────────────────────────────────────────

export function hybridStep(
  state: HybridState,
  cfg: HybridConfig,
  P_demand_override: number | null,
  dt: number,
): { state: HybridState; point: HybridPoint } {

  const v = Math.max(0.05, state.v_ms);
  const omega_wheel = v / cfg.wheel_r_m;
  const RPM_wheel = omega_wheel * 60 / (2 * Math.PI);
  const RPM_ice = Math.max(500, RPM_wheel * cfg.ice_gear);

  // ── Weight transfer (exponentially filtered acceleration) ─────────────────
  // Use previous step's filtered acceleration → no oscillation
  const a_p = state.a_smooth;
  const F_grav = cfg.mass_kg * 9.81;
  const dN = cfg.mass_kg * a_p * cfg.h_cg_m / cfg.wheelbase_m;
  const N_f = Math.max(0, F_grav * cfg.f_front - dN);    // front axle
  const N_r = Math.max(0, F_grav * (1 - cfg.f_front) + dN); // rear axle

  // ── Front axle EM traction limit (hub motors, no differential) ────────────
  // Each front wheel carries half the force, normal load is symmetric
  // → same result as combined limit mu * N_f
  const F_em_trac_limit = cfg.mu * N_f;

  // ── Rear axle ICE traction limit ──────────────────────────────────────────
  const F_ice_trac_limit = cfg.mu * N_r;

  // ── Battery instantaneous power capacity ──────────────────────────────────
  // P_max = V_eff² / (4·R0)   (matched-impedance peak power)
  const P_bat_max_W = packMaxPowerW(
    state.soc, state.V_rc1, state.V_rc2,
    cfg.pack_series, cfg.pack_parallel, cfg.pack_T_celsius,
  );
  const P_em_bat_limit_kW = P_bat_max_W * cfg.eta_em / 1000;

  // ── EM capability (front axle) ────────────────────────────────────────────
  // Field-weakening model: T_max(ω) = min(T_peak, P_avail/ω)
  const P_em_avail_kW = Math.min(
    state.boost_t < 5.0 ? cfg.P_em_peak_kW : cfg.P_em_cont_kW,
    P_em_bat_limit_kW,   // battery limit
  );
  const T_em_power_limit = P_em_avail_kW * 1000 / omega_wheel;
  const T_em_motor_limit = Math.min(cfg.T_em_peak_Nm, T_em_power_limit);
  const F_em_motor_max = T_em_motor_limit / cfg.wheel_r_m;
  const F_em_max = Math.min(F_em_motor_max, F_em_trac_limit);

  // ── ICE capability (rear axle) ────────────────────────────────────────────
  const ice_on = true; // ICE always on — primary power source
  let T_ice_shaft = 0;
  if (ice_on) T_ice_shaft = interpICETorque(RPM_ice);
  const T_ice_avail = T_ice_shaft * cfg.ice_gear * 0.97;
  const F_ice_motor_max = T_ice_avail / cfg.wheel_r_m;
  const F_ice_max = Math.min(F_ice_motor_max, F_ice_trac_limit);

  // ── Power demand calculation ──────────────────────────────────────────────
  const P_em_max_kW = F_em_max * v / 1000;
  const P_ice_max_kW = F_ice_max * v / 1000;
  const P_avail_kW = P_em_max_kW + P_ice_max_kW;

  const P_demand_kW = P_demand_override !== null
    ? P_demand_override / 1000
    : P_avail_kW;   // full throttle

  // ── ICE-first strategy ────────────────────────────────────────────────────
  // ICE covers demand first; EM supplements only on overload
  const F_demand = P_demand_kW > 0 ? P_demand_kW * 1000 / v : 0;
  let F_ice_use: number;
  let F_em_use: number;
  if (F_demand <= F_ice_max) {
    F_ice_use = Math.max(0, F_demand);
    F_em_use = 0;
  } else {
    F_ice_use = F_ice_max;
    F_em_use = Math.min(F_demand - F_ice_use, F_em_max);
  }

  const T_em_act = F_em_use * cfg.wheel_r_m;
  const T_ice_act = F_ice_use * cfg.wheel_r_m;
  const P_em_act_kW = T_em_act * omega_wheel / 1000;
  const P_ice_act_kW = T_ice_act * omega_wheel / 1000;
  const P_total_act_kW = P_em_act_kW + P_ice_act_kW;

  // ── Longitudinal dynamics ─────────────────────────────────────────────────
  // F_drag = ½ · ρ · CdA · v²   (ρ = 1.225 kg/m³)
  // F_roll = Crr · m · g
  const F_traction = F_em_use + F_ice_use;
  const F_drag = 0.5 * 1.225 * cfg.CdA_m2 * v * v;
  const F_roll = cfg.Crr * cfg.mass_kg * 9.81;
  const F_net = F_traction - F_drag - F_roll;
  const a = F_net / cfg.mass_kg;

  // Filtered acceleration for next weight transfer step
  const a_smooth_new = state.a_smooth * (1 - ALPHA_WEIGHT) + a * ALPHA_WEIGHT;

  // ── Battery — 2RC Thevenin ────────────────────────────────────────────────
  const P_bat_W = P_em_act_kW * 1000 / Math.max(0.5, cfg.eta_em);
  const batResult = battery2RCStep(
    state.soc, state.wh_em,
    state.V_rc1, state.V_rc2,
    cfg.pack_series, cfg.pack_parallel,
    cfg.pack_Q_Ah, cfg.pack_T_celsius,
    P_bat_W, dt,
  );

  // ── ICE fuel ──────────────────────────────────────────────────────────────
  const fuel_new = state.fuel_g + calcIceFuelStep(P_ice_act_kW * 1000, cfg.bsfc_gkWh, dt);

  // ── Boost timer (one-way latch) ───────────────────────────────────────────
  const boost_t_new = P_em_act_kW >= cfg.P_em_cont_kW
    ? Math.min(5.0, state.boost_t + dt)
    : state.boost_t;

  // ── Kinematics ────────────────────────────────────────────────────────────
  const v_new = Math.max(0, state.v_ms + a * dt);
  const x_new = state.x_m + state.v_ms * dt + 0.5 * a * dt * dt;
  const wh_mech_new = state.wh_mech + P_total_act_kW * dt / 3.6;

  // ── System efficiency ─────────────────────────────────────────────────────
  // Fuel power: P_fuel [W] = P_ice [kW] × BSFC [g/kWh] × HHV [Wh/g]
  // Unit analysis: kW × g/kWh × Wh/g = Wh/h = W ✓
  const HHV_gasoline = 12.78;  // Wh/g
  const P_fuel_W = P_ice_act_kW * cfg.bsfc_gkWh * HHV_gasoline;
  const P_in_total = batResult.V_bat * batResult.I_bat + P_fuel_W;
  const eta_sys = P_in_total > 1
    ? Math.min(1, (P_total_act_kW * 1000) / P_in_total)
    : 0;

  // ── BLDC breakdown & thermal models ──────────────────────────────────────
  // Symmetric load: BLDC1 = BLDC2 = half of total power
  const P_bat_per_bldc = P_bat_W / 2;
  const I_per_bldc = batResult.I_bat / 2;
  const eta_bldc = cfg.eta_em;

  // BLDC thermal model (R_th=0.08 K/W, mCp=600 J/K → T_eq≈92°C @ P_loss=840W)
  const R_TH_BLDC = 0.08, MCp_BLDC = 600;
  const P_loss_bldc = Math.max(0, P_bat_per_bldc * (1 - cfg.eta_em));
  const T_bldc_new = Math.max(25,
    state.T_bldc_C + (P_loss_bldc - (state.T_bldc_C - 25) / R_TH_BLDC) / MCp_BLDC * dt,
  );

  // ESC thermal model (R_th=0.15 K/W, mCp=200 J/K, ~2% loss)
  const R_TH_ESC = 0.15, MCp_ESC = 200;
  const P_loss_esc = P_bat_per_bldc * 0.02;
  const T_esc_new = Math.max(25,
    state.T_esc_C + (P_loss_esc - (state.T_esc_C - 25) / R_TH_ESC) / MCp_ESC * dt,
  );

  // ICE thermal model (R_th=4.5e-4 K/W, mCp=6000 J/K → 80→100°C @ full load)
  const T_ICE_BASE = 80;
  const R_TH_ICE = 4.5e-4, MCp_ICE = 6000;
  const eta_ice = Math.min(0.45, 1000 / (cfg.bsfc_gkWh * HHV_gasoline));
  const P_loss_ice_W = P_ice_act_kW * 1000 * (1 - eta_ice);
  const T_ice_new = Math.max(T_ICE_BASE,
    state.T_ice_C + (P_loss_ice_W - (state.T_ice_C - T_ICE_BASE) / R_TH_ICE) / MCp_ICE * dt,
  );

  // Efficiency map operating points
  const RPM_bldc = RPM_wheel * cfg.em_gear;
  const T_motor_Nm = T_em_act > 0 ? (T_em_act / 2) / cfg.em_gear : 0;
  const T_ice_shaft_Nm = T_ice_act > 0 ? T_ice_act / (cfg.ice_gear * 0.97) : 0;

  const newState: HybridState = {
    t: state.t + dt,
    v_ms: v_new,
    x_m: x_new,
    soc: batResult.soc_new,
    wh_em: batResult.wh_new,
    wh_mech: wh_mech_new,
    fuel_g: fuel_new,
    boost_t: boost_t_new,
    V_rc1: batResult.V_rc1,
    V_rc2: batResult.V_rc2,
    a_smooth: a_smooth_new,
    T_bldc_C: T_bldc_new,
    T_esc_C: T_esc_new,
    T_ice_C: T_ice_new,
  };

  const point: HybridPoint = {
    t: state.t,
    v_kmh: state.v_ms * 3.6,
    a_ms2: a,
    x_m: state.x_m,
    P_demand_kW,
    P_em_kW: P_em_act_kW,
    P_ice_kW: P_ice_act_kW,
    P_total_kW: P_total_act_kW,
    T_em_Nm: T_em_act,
    T_ice_Nm: T_ice_act,
    T_total_Nm: T_em_act + T_ice_act,
    RPM_wheel,
    RPM_ice,
    N_f,
    N_r,
    soc: batResult.soc_new * 100,
    I_bat: batResult.I_bat,
    V_bat: batResult.V_bat,
    V_rc1: batResult.V_rc1,
    V_rc2: batResult.V_rc2,
    wh_em: batResult.wh_new,
    fuel_g: fuel_new,
    wh_mech: wh_mech_new,
    eta_sys: eta_sys * 100,
    is_hybrid: P_ice_act_kW > 0.1,
    // BLDC breakdown
    I_BLDC1: I_per_bldc, I_BLDC2: I_per_bldc,
    P_BLDC1_kW: P_em_act_kW / 2, P_BLDC2_kW: P_em_act_kW / 2,
    P_elec_BLDC_kW: P_bat_per_bldc / 1000,
    T_BLDC1: T_bldc_new, T_BLDC2: T_bldc_new,
    T_ESC1: T_esc_new, T_ESC2: T_esc_new,
    eta_BLDC1: eta_bldc, eta_BLDC2: eta_bldc,
    // ICE
    T_ice_C: T_ice_new, eta_ice,
    // Operating points
    RPM_bldc, T_motor_Nm, T_ice_shaft_Nm,
  };

  return { state: newState, point };
}
