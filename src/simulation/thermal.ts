import { T_REF, DU_DT_POS, DU_DT_NEG } from './constants';

/**
 * Lumped pack thermal step: irreversible losses + reversible (entropic) heat − cooling.
 *
 * @param P_loss_W  irreversible heat [W]: I²·R0 plus the power dissipated in the RC resistors
 * @param series    cells in series; with I_pack split over the parallel strings the
 *                  pack holds S·P cells each carrying I_pack/P, so the summed
 *                  entropic heat is S · I_pack · T · (−dU/dT)
 */
export function stepThermal(
  T_K: number,
  I_pack: number,
  P_loss_W: number,
  series: number,
  T_amb_K: number,
  mCp: number,
  hA: number,
  dt: number,
): number {
  // Reversible heat, positive on discharge for LiCoO2/graphite (dU/dT < 0)
  const Q_r = reversibleHeat(I_pack, series, T_K);
  const Q_c = hA * (T_K - T_amb_K);
  return T_K + (P_loss_W + Q_r - Q_c) / mCp * dt;
}

/** Entropic heat of the whole pack [W] (I_pack > 0 = discharge) */
export function reversibleHeat(I_pack: number, series: number, T_K: number): number {
  return -I_pack * series * T_K * (DU_DT_POS - DU_DT_NEG);
}

/** Get Joule heat for data point */
export function jouleHeat(I_pack: number, R_contact: number): number {
  return I_pack * I_pack * R_contact;
}

export { T_REF };
