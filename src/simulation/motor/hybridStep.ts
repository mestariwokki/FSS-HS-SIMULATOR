import { ocvPack } from '../ocv';
import { interpICETorque, calcIceFuelStep } from './iceEngine';

// ── Config ────────────────────────────────────────────────────────────────

export interface HybridConfig {
  // Electric motor (high-level, combined n_motors values at wheel)
  P_em_peak_kW: number;   // total EM peak power
  P_em_cont_kW: number;   // total EM continuous power
  T_em_peak_Nm: number;   // max wheel torque from EM (at low speed)
  eta_em: number;         // combined ESC + winding efficiency (elec→mech)
  eta_regen: number;

  // ICE
  ice_gear: number;       // ICE shaft → wheel gear ratio (incl. final drive)
  bsfc_gkWh: number;      // brake-specific fuel consumption
  ice_start_delay_s: number;
  ice_rpm_min: number;    // below this wheel-implied RPM, ICE cannot contribute

  // Battery
  pack_series: number;
  pack_R_Ohm: number;
  pack_Q_Ah: number;

  // Vehicle
  mass_kg: number;
  wheel_r_m: number;
  CdA_m2: number;
  Crr: number;
  mu: number;
}

// ── State ─────────────────────────────────────────────────────────────────

export interface HybridState {
  t: number;
  v_ms: number;
  x_m: number;
  soc: number;
  wh_em: number;     // cumulative Wh drawn from battery
  wh_mech: number;   // cumulative mechanical Wh delivered to wheels
  fuel_g: number;    // cumulative fuel consumed (g)
  boost_t: number;   // seconds EM has been at/above P_em_cont
}

// ── Output point ──────────────────────────────────────────────────────────

export interface HybridPoint {
  t: number;
  v_kmh: number;
  a_ms2: number;
  x_m: number;
  // Power split
  P_demand_kW: number;
  P_em_kW: number;
  P_ice_kW: number;
  P_total_kW: number;
  // Torques at wheel
  T_em_Nm: number;
  T_ice_Nm: number;
  T_total_Nm: number;
  // RPM
  RPM_wheel: number;
  RPM_ice: number;
  // Battery
  soc: number;
  I_bat: number;
  V_bat: number;
  wh_em: number;
  // Fuel
  fuel_g: number;
  wh_mech: number;
  // Flags
  eta_sys: number;
  is_hybrid: boolean;
}

// ── Step function ─────────────────────────────────────────────────────────

export function hybridStep(
  state: HybridState,
  cfg: HybridConfig,
  P_demand_override: number | null,  // null = full throttle, else watts requested
  dt: number,
): { state: HybridState; point: HybridPoint } {

  const v = Math.max(0.05, state.v_ms);
  const omega_wheel = v / cfg.wheel_r_m;                       // rad/s at wheel
  const RPM_wheel = omega_wheel * 60 / (2 * Math.PI);
  const RPM_ice = Math.max(500, RPM_wheel * cfg.ice_gear);

  // ── EM capability (torque at wheel) ──────────────────────────────────────
  const P_em_avail_kW = state.boost_t < 5.0 ? cfg.P_em_peak_kW : cfg.P_em_cont_kW;
  // Torque limited by both current limit and power limit
  const T_em_power_limit = P_em_avail_kW * 1000 / omega_wheel;
  const T_em_avail = Math.min(cfg.T_em_peak_Nm, T_em_power_limit);

  // ── ICE capability (torque at wheel) ─────────────────────────────────────
  const ice_on = state.t >= cfg.ice_start_delay_s && RPM_ice >= cfg.ice_rpm_min;
  let T_ice_shaft = 0;
  let T_ice_avail = 0;
  if (ice_on) {
    T_ice_shaft = interpICETorque(RPM_ice);
    T_ice_avail = T_ice_shaft * cfg.ice_gear * 0.97;   // mech efficiency
  }

  // ── Hybrid control ────────────────────────────────────────────────────────
  // P_demand: in full-throttle mode this is total available; in cruise it's the
  // minimum needed to maintain speed.
  const P_em_max_kW = T_em_avail * omega_wheel / 1000;
  const P_ice_max_kW = T_ice_avail * omega_wheel / 1000;
  const P_avail_kW = P_em_max_kW + P_ice_max_kW;

  const P_demand_kW = P_demand_override !== null
    ? P_demand_override / 1000
    : P_avail_kW;   // full throttle

  let P_em_kW: number;
  let P_ice_kW: number;

  if (P_demand_kW <= P_em_max_kW) {
    P_em_kW = Math.max(0, P_demand_kW);
    P_ice_kW = 0;
  } else {
    P_em_kW = P_em_max_kW;
    P_ice_kW = Math.min(P_demand_kW - P_em_kW, P_ice_max_kW);
  }

  // Wheel torques from power
  const T_em_used = P_em_kW * 1000 / omega_wheel;
  const T_ice_used = P_ice_kW * 1000 / omega_wheel;
  const T_total_used = T_em_used + T_ice_used;

  // ── Traction limit ────────────────────────────────────────────────────────
  const F_traction_raw = T_total_used / cfg.wheel_r_m;
  const F_traction_limit = cfg.mu * cfg.mass_kg * 9.81;
  const F_traction = Math.min(F_traction_raw, F_traction_limit);
  const trac_scale = F_traction_raw > 0 ? F_traction / F_traction_raw : 1;

  const T_em_act = T_em_used * trac_scale;
  const T_ice_act = T_ice_used * trac_scale;
  const P_em_act_kW = T_em_act * omega_wheel / 1000;
  const P_ice_act_kW = T_ice_act * omega_wheel / 1000;
  const P_total_act_kW = P_em_act_kW + P_ice_act_kW;

  // ── Resistance forces ─────────────────────────────────────────────────────
  const F_drag = 0.5 * 1.225 * cfg.CdA_m2 * v * v;
  const F_roll = cfg.Crr * cfg.mass_kg * 9.81;

  // ── Net acceleration ──────────────────────────────────────────────────────
  const F_net = F_traction - F_drag - F_roll;
  const a = F_net / cfg.mass_kg;

  // ── Battery (EM electrical) ───────────────────────────────────────────────
  const V_oc = ocvPack(state.soc, cfg.pack_series);
  const P_bat_W = P_em_act_kW * 1000 / Math.max(0.5, cfg.eta_em);

  // Quadratic solve: P_bat = V_oc*I - I²*R  →  I²*R - V_oc*I + P_bat = 0
  const disc = V_oc * V_oc - 4 * cfg.pack_R_Ohm * P_bat_W;
  let I_bat: number;
  if (disc < 0) {
    I_bat = V_oc / (2 * cfg.pack_R_Ohm);   // current-limited
  } else {
    I_bat = (V_oc - Math.sqrt(disc)) / (2 * cfg.pack_R_Ohm);
  }
  I_bat = Math.max(0, I_bat);
  const V_bat = V_oc - I_bat * cfg.pack_R_Ohm;

  const soc_new = Math.max(0.005, state.soc - I_bat * dt / (3600 * cfg.pack_Q_Ah));
  const wh_em_new = state.wh_em + V_bat * I_bat * dt / 3600;

  // ── ICE fuel ──────────────────────────────────────────────────────────────
  const fuel_new = state.fuel_g + calcIceFuelStep(P_ice_act_kW * 1000, cfg.bsfc_gkWh, dt);

  // ── Boost timer (one-way latch) ───────────────────────────────────────────
  const boost_t_new = P_em_act_kW >= cfg.P_em_cont_kW
    ? Math.min(5.0, state.boost_t + dt)
    : state.boost_t;

  // ── Kinematics ────────────────────────────────────────────────────────────
  const v_new = Math.max(0, state.v_ms + a * dt);
  const x_new = state.x_m + state.v_ms * dt + 0.5 * a * dt * dt;
  const wh_mech_new = state.wh_mech + P_total_act_kW * dt / 3.6;  // kWh equivalent

  // ── Efficiency ────────────────────────────────────────────────────────────
  // Chemical energy rate from fuel: BSFC gives g/kWh mech → fuel energy = mech * (bsfc * HHV_fuel)
  // HHV gasoline ≈ 12.78 Wh/g
  const HHV_gasoline = 12.78;  // Wh/g
  const P_fuel_W = (P_ice_act_kW * 1000 * cfg.bsfc_gkWh / 3600) * HHV_gasoline;
  const P_in_total = V_bat * I_bat + P_fuel_W;
  const eta_sys = P_in_total > 1 ? Math.min(1, (P_total_act_kW * 1000) / P_in_total) : 0;

  const newState: HybridState = {
    t: state.t + dt,
    v_ms: v_new,
    x_m: x_new,
    soc: soc_new,
    wh_em: wh_em_new,
    wh_mech: wh_mech_new,
    fuel_g: fuel_new,
    boost_t: boost_t_new,
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
    soc: soc_new * 100,
    I_bat,
    V_bat,
    wh_em: wh_em_new,
    fuel_g: fuel_new,
    wh_mech: wh_mech_new,
    eta_sys: eta_sys * 100,
    is_hybrid: P_ice_act_kW > 0.1,
  };

  return { state: newState, point };
}
