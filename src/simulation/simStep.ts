import type { SimState, PackConfig, EcmConfig, BatteryDataPoint } from '../types';
import {
  D_S_POS, R_P_POS, K_POS, C_MAX_POS, L_POS,
  D_S_NEG, R_P_NEG, K_NEG, C_MAX_NEG, L_NEG,
  C_E, E_D, E_K,
  A_POS, A_NEG, A_CELL,
} from './constants';
import { U_pos, U_neg, ocvPack } from './ocv';
import { arrhenius, surfaceConc, exchangeCurrentDensity, butlerVolmer, updateBulkConc } from './spm';
import { stepThermal } from './thermal';

export interface SimStepResult {
  state: SimState;
  point: BatteryDataPoint;
}

/**
 * One battery step.
 *
 * Terminal voltage (equivalent-circuit model, the part that sets V_t):
 *   V_t = OCV_table(SOC) − I·R0_eff − V_RC1 − V_RC2
 * OCV comes from the EP9343126VVP table (cellData.ts), R0 is the measured /
 * estimated pack DC resistance, so electrode kinetics are already lumped into it.
 *
 * The single-particle model (Ramadass2004 LiCoO2/graphite) still runs alongside
 * for electrode diagnostics (surface stoichiometry, Butler–Volmer
 * overpotentials), but it is NOT added to V_t: its parameters belong to a
 * different cell and would double-count the losses already in R0.
 */
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

  // ── Terminal voltage (ECM) ──
  const voc_pack = ocvPack(state.soc, pack.series);
  const vt_pack = voc_pack - i_bat * R_eff - V_RC - V_RC2;

  // ── SPM electrode diagnostics ──
  // j > 0 = insertion. Discharge (i_bat > 0) inserts Li into the cathode and
  // extracts it from the anode.
  const Ds_p = arrhenius(D_S_POS, E_D, T);
  const Ds_n = arrhenius(D_S_NEG, E_D, T);
  const k_p = arrhenius(K_POS, E_K, T);
  const k_n = arrhenius(K_NEG, E_K, T);

  const I_cell = i_bat / pack.parallel;
  const I_dens = I_cell / A_CELL;
  const j_pos = I_dens / (A_POS * L_POS);
  const j_neg = -I_dens / (A_NEG * L_NEG);

  const cs_p = surfaceConc(state.c_avg_pos, j_pos, R_P_POS, Ds_p, C_MAX_POS);
  const cs_n = surfaceConc(state.c_avg_neg, j_neg, R_P_NEG, Ds_n, C_MAX_NEG);
  const xp = cs_p / C_MAX_POS;
  const xn = cs_n / C_MAX_NEG;
  const up = U_pos(xp);
  const un = U_neg(xn);

  const j0_p = exchangeCurrentDensity(k_p, C_E, cs_p, C_MAX_POS, T);
  const j0_n = exchangeCurrentDensity(k_n, C_E, cs_n, C_MAX_NEG, T);
  // Reported as voltage losses: both positive on discharge, negative on charge
  const eta_p_loss = butlerVolmer(j_pos, j0_p, T);
  const eta_n_loss = -butlerVolmer(j_neg, j0_n, T);

  const c_avg_pos = updateBulkConc(state.c_avg_pos, j_pos, R_P_POS, dt, C_MAX_POS);
  const c_avg_neg = updateBulkConc(state.c_avg_neg, j_neg, R_P_NEG, dt, C_MAX_NEG);

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

  // ── Thermal: all ohmic losses (R0 incl. ageing, both RC resistors) + entropic heat ──
  const Q_j = i_bat * i_bat * R_eff
    + (R1_pack > 0 ? V_RC * V_RC / R1_pack : 0)
    + (R2_pack > 0 ? V_RC2 * V_RC2 / R2_pack : 0);
  const T_K = stepThermal(T, i_bat, Q_j, pack.series, state.T_amb_K,
    pack.thermalMass_JK, pack.coolingUA_WK, dt);

  const newState: SimState = {
    t,
    soc,
    soc0: state.soc0,
    c_avg_pos,
    c_avg_neg,
    V_RC,
    V_RC2,
    T_K,
    T_amb_K: state.T_amb_K,
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
    eta_pos: eta_p_loss * 1000,
    eta_neg: eta_n_loss * 1000,
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
