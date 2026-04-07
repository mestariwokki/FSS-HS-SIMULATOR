export interface CellConfig {
  capacity_Ah: number;
  v_max: number;
  v_nom: number;
  v_min: number;
}

export interface PackConfig {
  series: number;
  parallel: number;
  cell: CellConfig;
  resistance_Ohm: number;
  thermalMass_JK: number;
  coolingUA_WK: number;
  v_max: number;
  v_nom: number;
  v_min: number;
  capacity_Ah: number;
  i_max: number;
}

export interface EcmConfig {
  R1_Ohm: number;
  tau1_s: number;
  R2_Ohm: number;
  tau2_s: number;
  cycles: number;
  kQ: number;
  kR: number;
  soh_cap: number;
  soh_res: number;
}

export interface MotorConfig {
  Kt_NmA: number;
  kV_rpmV: number;
  R_winding_Ohm: number;
  P_cont_kW: number;
  P_peak_kW: number;
  n_motors: number;
  gear_ratio: number;
  wheel_diameter_m: number;
  eta_esc: number;
  I_cont_A: number;
  I_peak_A: number;
  eta_regen: number;
  eta_motor: number;
  mCp_motor_JK: number;
  Rth_motor_KW: number;
  mCp_esc_JK: number;
  Rth_esc_KW: number;
}

export interface VehicleConfig {
  mass_kg: number;
  CdA_m2: number;
  Crr: number;
  mu: number;
  f_front: number;
  h_cg_m: number;
  wheelbase_m: number;
}

export interface SimState {
  t: number;
  soc: number;
  soc0: number;
  c_avg_pos: number;
  c_avg_neg: number;
  V_RC: number;
  V_RC2: number;
  T_K: number;
  ah: number;
  wh_out: number;
  wh_in: number;
}

export interface MotorSimState {
  t: number;
  soc: number;
  ah: number;
  wh_out: number;
  wh_regen: number;
  V_RC: number;
  V_RC2: number;
  T_motor_C: number;
  T_esc_C: number;
  v_kmh: number;
  x_m: number;
  boost_t: number;
  trac_ratio: number;
  acc75_done: boolean;
  t_75: number | null;
  v_75: number | null;
  a_prev: number;
  trac_switch_t: number | null;
  trac_switch_v: number | null;
}

export interface BatteryDataPoint {
  t: number;
  v_oc: number;
  v_t: number;
  soc: number;
  ah: number;
  i_bat: number;
  p_inst: number;
  T_C: number;
  eta_pos: number;
  eta_neg: number;
  wh_out: number;
  wh_in: number;
  xp: number;
  xn: number;
  up: number;
  un: number;
  j0p: number;
  j0n: number;
  Q_j: number;
  vrc: number;
  vrc2: number;
  soh_cap: number;
  soh_res: number;
  q_eff: number;
}

export interface MotorDataPoint {
  t: number;
  P_mech_kW: number;
  P_bat_kW: number;
  P_regen_kW: number;
  RPM: number;
  I_bat: number;
  I_m: number;
  V_t: number;
  V_oc: number;
  soc: number;
  T_motor: number;
  T_esc: number;
  T_wheel: number;
  eta: number;
  v_kmh: number;
  ah: number;
  wh_out: number;
  wh_regen: number;
  trac_ratio: number;
  x_m?: number;
  F_el_avail?: number;
  F_el_use?: number;
}

export interface CellPreset {
  id: string;
  name: string;
  series: number;
  parallel: number;
  cell: CellConfig;
  resistance_mOhm: number;
  thermalMass_JK: number;
  coolingUA_WK: number;
  builtin?: boolean;
}

export type SimMode = 'const' | 'profile' | 'charge';
export type MotorMode = 'const' | 'profile' | 'regen' | 'acc75';

export interface ProfileStep {
  duration_s: number;
  current_A: number;
}

export interface MotorProfileStep {
  duration_s: number;
  speed_kmh: number;
  power_kW: number;
}

export interface EffMapPoint {
  rpm: number;
  torque_Nm: number;
  eta: number;
  P_mech_kW: number;
  I_motor_A: number;
  valid: boolean;
}

export interface SimStats {
  min_v: number;
  max_T: number;
  max_eta: number;
  max_vsag: number;
}

export interface MotorSimStats {
  max_I_bat: number;
  min_Vt: number;
  max_T_m: number;
  max_T_e: number;
  eta_sum: number;
  eta_n: number;
  t_target: number | null;
}
