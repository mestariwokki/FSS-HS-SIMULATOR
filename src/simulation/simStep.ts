import type { SimState, PackConfig, EcmConfig, BatteryDataPoint } from '../types';
import {
  F, R_GAS, T_REF,
  D_S_POS, R_P_POS, K_POS, C_MAX_POS, EPS_POS, L_POS,
  D_S_NEG, R_P_NEG, K_NEG, C_MAX_NEG, EPS_NEG, L_NEG,
  ALPHA, C_E, DU_DT_POS, DU_DT_NEG, E_D, E_K,
  A_POS, A_NEG, A_CELL,
} from './constants';
import { U_pos, U_neg } from './ocv';
import { arrhenius } from './spm';

export interface SimStepResult {
  state: SimState;
  point: BatteryDataPoint;
}

export function simStep(
  state: SimState,
  pack: PackConfig,
  ecm: EcmConfig,
  i_bat: number,
  dt: number,
): SimStepResult {
  const T = state.T_K;

  // SoH: effective parameters
  const Q_eff = pack.capacity_Ah * ecm.soh_cap;
  const R_eff = pack.resistance_Ohm * ecm.soh_res;

  // 2RC Thevenin: exponential update (exact, dt-independent)
  const R1_pack = ecm.R1_Ohm * pack.series / pack.parallel;
  const R2_pack = ecm.R2_Ohm * pack.series / pack.parallel;
  const alpha1 = Math.exp(-dt / ecm.tau1_s);
  const alpha2 = Math.exp(-dt / ecm.tau2_s);
  const V_RC = state.V_RC * alpha1 + i_bat * R1_pack * (1.0 - alpha1);
  const V_RC2 = state.V_RC2 * alpha2 + i_bat * R2_pack * (1.0 - alpha2);

  // Arrhenius-corrected parameters
  const Ds_p = arrhenius(D_S_POS, E_D, T);
  const Ds_n = arrhenius(D_S_NEG, E_D, T);
  const k_p = arrhenius(K_POS, E_K, T);
  const k_n = arrhenius(K_NEG, E_K, T);

  // Interfacial current density [A/m2]
  const I_cell = i_bat / pack.parallel;
  const I_dens = I_cell / A_CELL;
  const j_pos = I_dens / (A_POS * L_POS);
  const j_neg = -I_dens / (A_NEG * L_NEG);

  // Surface concentration - parabolic approximation
  const cs_p = Math.max(50, Math.min(C_MAX_POS - 50,
    state.c_avg_pos - j_pos * R_P_POS / (5 * Ds_p * F)));
  const cs_n = Math.max(50, Math.min(C_MAX_NEG - 50,
    state.c_avg_neg - j_neg * R_P_NEG / (5 * Ds_n * F)));

  // Stoichiometry from surface concentration
  const xp = cs_p / C_MAX_POS;
  const xn = cs_n / C_MAX_NEG;

  // OCP
  const up = U_pos(xp);
  const un = U_neg(xn);

  // Exchange current density j0 (Butler-Volmer)
  const j0_p = k_p * F * Math.sqrt(C_E * cs_p * (C_MAX_POS - cs_p));
  const j0_n = k_n * F * Math.sqrt(C_E * cs_n * (C_MAX_NEG - cs_n));

  // Overpotential eta (Butler-Volmer inversion - arcsinh)
  const eta_p = j0_p > 1e-20
    ? (R_GAS * T / (ALPHA * F)) * Math.asinh(j_pos / (2 * j0_p))
    : 0;
  const eta_n = j0_n > 1e-20
    ? (R_GAS * T / (ALPHA * F)) * Math.asinh(j_neg / (2 * j0_n))
    : 0;

  // Terminal voltage (per cell -> times S)
  const voc_cell = U_pos(xp) - U_neg(xn);
  const v_cell = up - un - eta_p - eta_n
    - i_bat * R_eff / pack.series
    - V_RC / pack.series
    - V_RC2 / pack.series;
  const voc_pack = voc_cell * pack.series;
  const vt_pack = v_cell * pack.series;

  // Update bulk concentrations (Euler)
  const dc_p = +j_pos / (F * EPS_POS * L_POS);
  const dc_n = +j_neg / (F * EPS_NEG * L_NEG);
  const c_avg_pos = Math.max(C_MAX_POS * 0.005,
    Math.min(C_MAX_POS * 0.995, state.c_avg_pos + dc_p * dt));
  const c_avg_neg = Math.max(C_MAX_NEG * 0.005,
    Math.min(C_MAX_NEG * 0.995, state.c_avg_neg + dc_n * dt));

  // Ah
  const ah = state.ah + i_bat * dt / 3600;

  // Wh
  const P_inst = i_bat * vt_pack;
  let wh_out = state.wh_out;
  let wh_in = state.wh_in;
  if (i_bat > 0) wh_out += P_inst * dt / 3600;
  else wh_in += (-P_inst) * dt / 3600;

  // SOC Coulomb counting
  const soc = Math.max(0, Math.min(1, state.soc0 - ah / Q_eff));
  const t = state.t + dt;

  // Thermal model
  const Q_j = i_bat * i_bat * pack.resistance_Ohm;
  const Q_r = I_cell * T * (DU_DT_POS - DU_DT_NEG);
  const Q_c = pack.coolingUA_WK * (T - T_REF);
  const T_K = Math.max(T_REF, T + (Q_j + Q_r - Q_c) / pack.thermalMass_JK * dt);

  const newState: SimState = {
    t,
    soc,
    soc0: state.soc0,
    c_avg_pos,
    c_avg_neg,
    V_RC,
    V_RC2,
    T_K,
    ah,
    wh_out,
    wh_in,
  };

  const point: BatteryDataPoint = {
    t,
    v_oc: voc_pack,
    v_t: vt_pack,
    soc: soc * 100,
    ah,
    i_bat,
    p_inst: P_inst,
    T_C: T_K - 273.15,
    eta_pos: eta_p * 1000,
    eta_neg: eta_n * 1000,
    wh_out,
    wh_in,
    xp,
    xn,
    up,
    un,
    j0p: j0_p,
    j0n: j0_n,
    Q_j,
    vrc: V_RC,
    vrc2: V_RC2,
    soh_cap: ecm.soh_cap * 100,
    soh_res: (1 / ecm.soh_res) * 100,
    q_eff: Q_eff,
  };

  return { state: newState, point };
}
