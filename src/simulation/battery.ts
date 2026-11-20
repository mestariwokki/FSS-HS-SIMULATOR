/**
 * 2RC Thevenin equivalent circuit model for the EP9343126VVP HV-LiCoO2 pouch cell.
 *
 * V_terminal = V_oc(SOC,T) - I·R0(SOC,T) - V_rc1(SOC,T) - V_rc2(SOC,T)
 * Parameters come from cellModel.ts (same model as the Battery and Endurance tabs).
 *
 * RC element update (exact discrete):
 *   V_rc(t+dt) = V_rc(t)·exp(-dt/τ) + I·R·(1 - exp(-dt/τ))
 */
import { stepRC } from './ecm';
import { packCurrentLimits } from './cellData';
import { EP9343126VVP_MODEL, cellRC, arrheniusFactor, defaultPackModel, ocvCellT } from './cellModel';

// ── EP9343126VVP resistances — from the shared cell model (cellModel.ts) ──
// R0 here is per cell incl. its share of the HSC-internal resistance and the
// cables (busbars, AIR, fuse, shunt, harness), so pack R0 = r0Cell · S / P.
// RC1 = slow diffusion term, RC2 = fast charge-transfer term.
const PACK_DEFAULT = defaultPackModel();
const R_EXTRA_PER_CELL = (PACK_DEFAULT.R_hsc_internal_Ohm + PACK_DEFAULT.R_cables_Ohm)
  * PACK_DEFAULT.parallel / PACK_DEFAULT.series;

export const TAU1_S = EP9343126VVP_MODEL.tau2_s;  // diffusion time constant [s]
export const TAU2_S = EP9343126VVP_MODEL.tau1_s;  // charge-transfer time constant [s]

/** Per-cell R0 at given SOC, 25 °C [Ω/cell] incl. interconnect share */
export function r0Cell(soc: number): number {
  return cellRC(soc, 25).R0 + R_EXTRA_PER_CELL;
}

/** Per-cell slow (diffusion) RC resistance at given SOC, 25 °C [Ω/cell] */
export function r1Cell(soc: number, T_celsius = 25): number {
  return cellRC(soc, T_celsius).R2;
}

/** Per-cell fast (charge-transfer) RC resistance at given SOC, 25 °C [Ω/cell] */
export function r2Cell(soc: number, T_celsius = 25): number {
  return cellRC(soc, T_celsius).R1;
}

/**
 * Arrhenius temperature correction for the ohmic resistance (cell part only;
 * the copper/contact share is taken as temperature independent).
 */
export function r0TempCorrect(r0_ref_Ohm: number, T_celsius: number): number {
  const extra = Math.min(R_EXTRA_PER_CELL, r0_ref_Ohm);
  return (r0_ref_Ohm - extra) * arrheniusFactor(EP9343126VVP_MODEL.Ea_R0, T_celsius) + extra;
}

/**
 * Advance both RC elements one time step.
 * Returns [V_rc1_new, V_rc2_new].
 */
export function step2RC(
  V_rc1: number,
  V_rc2: number,
  I: number,        // pack current [A]
  R1_pack: number,  // pack R1 [Ω]
  R2_pack: number,  // pack R2 [Ω]
  dt: number,
): [number, number] {
  return [
    stepRC(V_rc1, I, R1_pack, TAU1_S, dt),
    stepRC(V_rc2, I, R2_pack, TAU2_S, dt),
  ];
}

/** Terminal voltage: V_oc − I·R0 − V_rc1 − V_rc2 */
export function terminalVoltage(
  V_oc: number,
  I: number,
  R0_pack: number,
  V_rc1: number,
  V_rc2: number,
): number {
  return V_oc - I * R0_pack - V_rc1 - V_rc2;
}

// ── Pack-level step ───────────────────────────────────────────────────────

/**
 * Maximum power the pack may deliver at the current state [W].
 * The lower of
 *   - the matched-impedance limit P = V_eff² / (4·R0_pack), and
 *   - the cell current limit P = (V_eff − I_max·R0)·I_max,
 * where V_eff = V_oc − V_rc1 − V_rc2 and I_max defaults to the datasheet
 * continuous discharge current (99 A/cell × parallel strings).
 */
export function packMaxPowerW(
  soc: number,
  V_rc1: number,
  V_rc2: number,
  pack_series: number,
  pack_parallel: number,
  T_celsius: number,
  I_max_A: number = packCurrentLimits(pack_parallel).dis_cont,
): number {
  const V_oc = ocvCellT(soc, T_celsius) * pack_series;
  const R0 = r0TempCorrect(r0Cell(soc), T_celsius) * pack_series / pack_parallel;
  const V_eff = Math.max(0, V_oc - V_rc1 - V_rc2);
  const P_matched = V_eff * V_eff / (4 * R0);
  const I = Math.min(I_max_A, V_eff / (2 * R0));
  const P_current = Math.max(0, (V_eff - I * R0) * I);
  return Math.min(P_matched, P_current);
}

export interface Battery2RCResult {
  I_bat: number;
  V_bat: number;
  V_rc1: number;
  V_rc2: number;
  soc_new: number;
  wh_new: number;
}

/**
 * One integration step of the 2RC Thevenin pack model.
 *
 * @param soc         State of charge [0–1]
 * @param wh_em       Cumulative Wh drawn so far
 * @param V_rc1       RC1 element voltage [V]
 * @param V_rc2       RC2 element voltage [V]
 * @param pack_series Number of cells in series
 * @param pack_parallel Number of parallel strings
 * @param pack_Q_Ah   Total pack capacity [Ah] (all strings combined)
 * @param T_celsius   Cell temperature [°C]
 * @param P_elec_W    Electrical power demanded from pack [W]
 * @param dt          Time step [s]
 */
export function battery2RCStep(
  soc: number,
  wh_em: number,
  V_rc1: number,
  V_rc2: number,
  pack_series: number,
  pack_parallel: number,
  pack_Q_Ah: number,
  T_celsius: number,
  P_elec_W: number,
  dt: number,
): Battery2RCResult {
  const V_oc = ocvCellT(soc, T_celsius) * pack_series;

  // Per-cell resistances at (SOC, T) → pack (series raises V, parallel divides R)
  const r0_corrected = r0TempCorrect(r0Cell(soc), T_celsius);
  const R0_pack = r0_corrected * pack_series / pack_parallel;
  const R1_pack = r1Cell(soc, T_celsius) * pack_series / pack_parallel;
  const R2_pack = r2Cell(soc, T_celsius) * pack_series / pack_parallel;

  // Solve for current given power demand:
  //   P = V_terminal · I  and  V_terminal = V_oc − I·R0 − V_rc1 − V_rc2
  //   → I²·R0 + I·(V_rc1 + V_rc2 − V_oc) + P = 0
  const V_rc_sum = V_rc1 + V_rc2;
  const disc = (V_oc - V_rc_sum) ** 2 - 4 * R0_pack * P_elec_W;
  let I_bat: number;
  if (disc < 0) {
    // Power exceeds what pack can deliver — current-limited
    I_bat = (V_oc - V_rc_sum) / (2 * R0_pack);
  } else {
    I_bat = ((V_oc - V_rc_sum) - Math.sqrt(disc)) / (2 * R0_pack);
  }
  I_bat = Math.max(0, I_bat);

  const V_bat = terminalVoltage(V_oc, I_bat, R0_pack, V_rc1, V_rc2);
  const [V_rc1_new, V_rc2_new] = step2RC(V_rc1, V_rc2, I_bat, R1_pack, R2_pack, dt);

  const soc_new = Math.max(0.005, soc - I_bat * dt / (3600 * pack_Q_Ah));
  const wh_new = wh_em + V_bat * I_bat * dt / 3600;

  return {
    I_bat,
    V_bat,
    V_rc1: V_rc1_new,
    V_rc2: V_rc2_new,
    soc_new,
    wh_new,
  };
}
