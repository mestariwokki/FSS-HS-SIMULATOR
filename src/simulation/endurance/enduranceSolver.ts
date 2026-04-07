import type { PackConfig, EcmConfig, MotorConfig, VehicleConfig } from '../../types';
import { simulateAccelSegment, simulateBrakeSegment, simulateCornerSegment } from './enduranceModel';

export interface EnduranceConfig {
  lap_m: number;
  n_laps: number;
  v_max_kmh: number;
  v_corner_kmh: number;
  n_corners: number;
  soc0_pct: number;
  P_ice_kW: number;
  eta_ice: number;
}

export interface EnduranceResult {
  soc_per_lap: number[];
  total_wh: number;
  total_wh_regen: number;
  e_per_lap_wh: number;
  regen_per_lap_wh: number;
  net_per_lap_wh: number;
  lap_time_s: number;
  total_time_s: number;
  e_usable_wh: number;
  laps_possible: number;
  can_finish: boolean;
  deficit_wh: number;
  soc_end: number;
}

export function runEndurance(
  config: EnduranceConfig,
  pack: PackConfig,
  ecm: EcmConfig,
  mc: MotorConfig,
  vehicle: VehicleConfig,
): EnduranceResult {
  const accel = simulateAccelSegment(
    config.v_corner_kmh, config.v_max_kmh,
    vehicle.mass_kg, vehicle.CdA_m2, vehicle.Crr,
    mc.eta_motor, mc.eta_esc,
    mc.P_peak_kW, mc.n_motors,
    mc.Kt_NmA, mc.I_peak_A,
    mc.gear_ratio, mc.wheel_diameter_m,
    vehicle.mu, vehicle.f_front,
  );

  const brake = simulateBrakeSegment(
    config.v_max_kmh, config.v_corner_kmh,
    vehicle.mass_kg, mc.eta_regen, mc.eta_esc,
  );

  const corner = simulateCornerSegment(
    config.v_corner_kmh, 25,
    vehicle.mass_kg, vehicle.CdA_m2, vehicle.Crr,
    mc.eta_motor, mc.eta_esc,
  );

  const corners_total_dist = config.n_corners * (corner.distance_m + accel.distance_m + brake.distance_m);
  const straight_dist = Math.max(0, config.lap_m - corners_total_dist);
  const v_max_ms = config.v_max_kmh / 3.6;
  const straight_t = straight_dist / v_max_ms;
  const F_drag_straight = 0.5 * 1.225 * vehicle.CdA_m2 * v_max_ms * v_max_ms
    + vehicle.mass_kg * 9.81 * vehicle.Crr;
  const P_straight_W = F_drag_straight * v_max_ms / (mc.eta_motor * mc.eta_esc);
  const E_straight_Wh = P_straight_W * straight_t / 3600;

  const e_per_lap_wh = config.n_corners * (accel.wh + brake.wh + corner.wh) + E_straight_Wh;
  const regen_per_lap_wh = config.n_corners * Math.abs(brake.wh);
  const lap_time_s = config.n_corners * (accel.time_s + brake.time_s + corner.time_s) + straight_t;

  const Q_eff_Ah = pack.capacity_Ah * ecm.soh_cap;
  const E_pack_Wh = Q_eff_Ah * pack.v_nom;
  const E_usable_Wh = E_pack_Wh * (config.soc0_pct - 20) / 100;

  const E_ice_per_lap_Wh = config.P_ice_kW * 1000 * lap_time_s / 3600;
  const net_per_lap_wh = Math.max(0, e_per_lap_wh - E_ice_per_lap_Wh);
  const laps_possible = E_usable_Wh / Math.max(net_per_lap_wh, 0.001);
  const can_finish = laps_possible >= config.n_laps;

  const soc_per_lap: number[] = [];
  let soc = config.soc0_pct / 100;
  for (let i = 0; i <= config.n_laps; i++) {
    soc_per_lap.push(soc * 100);
    const dSOC = (net_per_lap_wh / 1000) / (E_pack_Wh / 1000);
    soc = Math.max(0, soc - dSOC);
  }

  const deficit_wh = can_finish ? 0 : (net_per_lap_wh * config.n_laps - E_usable_Wh);

  return {
    soc_per_lap,
    total_wh: e_per_lap_wh * config.n_laps,
    total_wh_regen: regen_per_lap_wh * config.n_laps,
    e_per_lap_wh,
    regen_per_lap_wh,
    net_per_lap_wh,
    lap_time_s,
    total_time_s: lap_time_s * config.n_laps,
    e_usable_wh: E_usable_Wh,
    laps_possible,
    can_finish,
    deficit_wh,
    soc_end: soc_per_lap[config.n_laps] ?? 0,
  };
}
