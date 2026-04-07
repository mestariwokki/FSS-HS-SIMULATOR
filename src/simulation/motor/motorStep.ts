import type { PackConfig, EcmConfig, MotorSimState, MotorDataPoint } from '../../types';
import { ocvPack } from '../ocv';
import { kVradFromKv } from './motorConstants';

export interface MotorStepConfig {
  Kt: number;
  kV: number;
  Rw: number;
  eta_c: number;
  eta_regen: number;
  gear: number;
  wheel_d_mm: number;
  P_cont: number;
  P_peak: number;
  I_cont: number;
  I_peak: number;
  n: number;
  eta_m: number;
  mCp_m: number;
  R_th_m: number;
  mCp_e: number;
  R_th_e: number;
  T_amb: number;
}

export interface MotorStepResult {
  state: MotorSimState;
  point: MotorDataPoint;
}

export function motorStep(
  P_mech_kW: number,
  spd_kmh: number,
  state: MotorSimState,
  pack: PackConfig,
  ecm: EcmConfig,
  mc: MotorStepConfig,
  dt: number,
): MotorStepResult {
  const Q_eff = pack.capacity_Ah * ecm.soh_cap;
  const R_pack = pack.resistance_Ohm * ecm.soh_res;
  const V_oc = ocvPack(state.soc, pack.series);

  const kV_rad = kVradFromKv(mc.kV);
  const wheel_m = mc.wheel_d_mm / 1000;
  const wheel_circ = Math.PI * wheel_m;

  // RPM from vehicle speed
  const RPM_motor = Math.max(1, (spd_kmh / 3.6) / wheel_circ * 60 * mc.gear);
  const omega_motor = RPM_motor * 2 * Math.PI / 60;

  let I_bat: number;
  let V_t: number;
  let P_bat_W: number;
  let P_mech_act_W: number;
  let I_motor_per: number;
  let T_wheel_actual: number;
  const is_regen = P_mech_kW < 0;

  let boost_t = state.boost_t;

  if (is_regen) {
    // REGEN: generator mode
    const P_regen_mech = -P_mech_kW * 1000;
    const P_bat_regen = P_regen_mech * mc.eta_regen;

    const disc_r = V_oc * V_oc + 4 * R_pack * P_bat_regen;
    const I_ch = (-V_oc + Math.sqrt(disc_r)) / (2 * R_pack);
    I_bat = -I_ch;
    V_t = V_oc + I_ch * R_pack;
    if (V_t > pack.v_max) {
      V_t = pack.v_max;
      I_bat = -(V_t - V_oc) / R_pack;
    }
    P_bat_W = I_bat * V_t;
    P_mech_act_W = P_mech_kW * 1000;
    I_motor_per = P_regen_mech / (mc.n * Math.max(V_oc, 1));
    T_wheel_actual = 0;
  } else {
    // MOTOR: traction
    const V_bemf = omega_motor / kV_rad;
    let I_motor_ideal = (P_mech_kW * 1000 / mc.n) / Math.max(V_bemf, 1.0);

    const I_limit = (boost_t < 5.0) ? mc.I_peak : mc.I_cont;
    I_motor_per = Math.min(I_motor_ideal, I_limit);

    const T_motor_act = mc.Kt * I_motor_per;
    P_mech_act_W = T_motor_act * omega_motor * mc.n;
    T_wheel_actual = T_motor_act * mc.gear * 0.97;

    const P_elec_m = V_bemf * I_motor_per + I_motor_per * I_motor_per * mc.Rw;
    const P_bat_total = (P_elec_m * mc.n) / mc.eta_c;

    const disc2 = V_oc * V_oc - 4 * R_pack * P_bat_total;
    if (disc2 < 0) {
      I_bat = V_oc / (2 * R_pack);
    } else {
      I_bat = (V_oc - Math.sqrt(disc2)) / (2 * R_pack);
    }
    I_bat = Math.min(I_bat, 249);
    V_t = V_oc - I_bat * R_pack;
    P_bat_W = I_bat * V_t;

    if (I_motor_per >= mc.I_cont) {
      boost_t = Math.min(5.0, boost_t + dt);
    } else {
      boost_t = Math.max(0, boost_t - dt * 2);
    }
  }

  // SOC & energy
  const soc = Math.max(0, Math.min(1, state.soc - I_bat * dt / (3600 * Q_eff)));
  const ah = state.ah + I_bat * dt / 3600;
  let wh_out = state.wh_out;
  let wh_regen = state.wh_regen;
  if (I_bat > 0) wh_out += P_bat_W * dt / 3600;
  else wh_regen += (-P_bat_W) * dt / 3600;

  // 2RC Thevenin
  const R1_pack = ecm.R1_Ohm * pack.series / pack.parallel;
  const R2_pack = ecm.R2_Ohm * pack.series / pack.parallel;
  const alpha_m1 = Math.exp(-dt / ecm.tau1_s);
  const alpha_m2 = Math.exp(-dt / ecm.tau2_s);
  const V_RC = state.V_RC * alpha_m1 + I_bat * R1_pack * (1 - alpha_m1);
  const V_RC2 = state.V_RC2 * alpha_m2 + I_bat * R2_pack * (1 - alpha_m2);

  // Thermal models
  const T_amb = mc.T_amb;
  const P_loss_m = Math.max(0, is_regen ? 0 : P_bat_W * (1 - mc.eta_m));
  const P_loss_e = Math.max(0, is_regen ? 0 : P_bat_W * (1 - mc.eta_c));
  let T_motor = state.T_motor_C + (P_loss_m - (state.T_motor_C - T_amb) / mc.R_th_m) / mc.mCp_m * dt;
  let T_esc = state.T_esc_C + (P_loss_e - (state.T_esc_C - T_amb) / mc.R_th_e) / mc.mCp_e * dt;
  T_motor = Math.max(T_amb, T_motor);
  T_esc = Math.max(T_amb, T_esc);

  // Overall efficiency
  const eta = (P_bat_W > 10) ? Math.min(1, P_mech_act_W / P_bat_W) : 0;

  const newState: MotorSimState = {
    ...state,
    soc,
    ah,
    wh_out,
    wh_regen,
    V_RC,
    V_RC2,
    T_motor_C: T_motor,
    T_esc_C: T_esc,
    boost_t,
  };

  const point: MotorDataPoint = {
    t: state.t,
    P_mech_kW: P_mech_act_W / 1000,
    P_bat_kW: P_bat_W / 1000,
    P_regen_kW: is_regen ? -P_bat_W / 1000 : 0,
    I_bat,
    V_t,
    V_oc,
    soc: soc * 100,
    T_motor,
    T_esc,
    eta: eta * 100,
    I_m: I_motor_per,
    RPM: Math.round(RPM_motor),
    T_wheel: T_wheel_actual,
    ah,
    wh_out,
    wh_regen,
    v_kmh: state.v_kmh,
    trac_ratio: state.trac_ratio,
  };

  return { state: newState, point };
}
