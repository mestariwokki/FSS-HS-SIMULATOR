import { T_REF, DU_DT_POS, DU_DT_NEG } from './constants';

/** Mean V_rc²/R during a constant-current step, including relaxation at rest. */
export function rcHeatW(initialV: number, current: number, resistance: number, tau: number, dt: number): number {
  if (resistance <= 0) return 0;
  if (dt === 0) return initialV * initialV / resistance;
  const x = dt / tau;
  const steadyV = current * resistance;
  const delta = initialV - steadyV;
  const meanDecay = -Math.expm1(-x) / x;
  const meanDecaySquared = -Math.expm1(-2 * x) / (2 * x);
  return Math.max(0, (steadyV ** 2 + 2 * steadyV * delta * meanDecay + delta ** 2 * meanDecaySquared) / resistance);
}

/** Lumped pack temperature. Current is positive on discharge. */
export function stepThermal(
  T_K: number,
  I_pack: number,
  I_cell: number,
  R_contact: number,
  T_amb_K: number,
  mCp: number,
  hA: number,
  dt: number,
  cellCount = 1,
  polarizationHeat_W = 0,
): number {
  const ohmicHeat = jouleHeat(I_pack, R_contact);
  // Reversible heat per cell is -I_cell T d(OCV)/dT.
  const reversibleHeat = -cellCount * I_cell * T_K * (DU_DT_POS - DU_DT_NEG);
  const heat = ohmicHeat + polarizationHeat_W + reversibleHeat;
  const netPower = heat - hA * (T_K - T_amb_K);
  // Integrate linear cooling exactly with heat generation held at its step value.
  const response = hA === 0 ? dt / mCp : -Math.expm1(-hA * dt / mCp) / hA;
  return T_K + netPower * response;
}

/** Get Joule heat for data point */
export function jouleHeat(I_pack: number, R_contact: number): number {
  return I_pack * I_pack * R_contact;
}

export { T_REF };
