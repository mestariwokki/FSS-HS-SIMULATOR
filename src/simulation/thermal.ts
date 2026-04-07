import { T_REF, DU_DT_POS, DU_DT_NEG } from './constants';

/** Full thermal step with Joule + reversible + cooling */
export function stepThermal(
  T_K: number,
  I_pack: number,
  I_cell: number,
  R_contact: number,
  T_amb_K: number,
  mCp: number,
  hA: number,
  dt: number,
): number {
  // Joule heating: I^2 * R_contact
  const Q_j = I_pack * I_pack * R_contact;
  // Reversible (entropic) heat: I_cell * T * (dU/dT_pos - dU/dT_neg)
  const Q_r = I_cell * T_K * (DU_DT_POS - DU_DT_NEG);
  // Cooling: hA * (T - T_amb)
  const Q_c = hA * (T_K - T_amb_K);

  const T_new = T_K + (Q_j + Q_r - Q_c) / mCp * dt;
  return Math.max(T_amb_K, T_new);
}

/** Get Joule heat for data point */
export function jouleHeat(I_pack: number, R_contact: number): number {
  return I_pack * I_pack * R_contact;
}

export { T_REF };
