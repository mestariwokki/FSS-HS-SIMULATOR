import { R_GAS, T_REF, F, ALPHA } from './constants';

/** Arrhenius temperature correction */
export function arrhenius(k0: number, Ea: number, T_K: number): number {
  return k0 * Math.exp(-Ea / R_GAS * (1 / T_K - 1 / T_REF));
}

/**
 * Parabolic SPM surface concentration approximation.
 * j > 0 = lithium inserted into the particle (cathode during discharge),
 * so the surface is richer than the bulk: c_s = c_avg + j·R_p/(5·D_s·F).
 */
export function surfaceConc(c_avg: number, j: number, R_p: number, D_s: number, c_max: number): number {
  const cs = c_avg + j * R_p / (5 * D_s * F);
  return Math.max(50, Math.min(c_max - 50, cs));
}

/** Exchange current density j0 with Arrhenius correction */
export function exchangeCurrentDensity(
  k: number,
  c_e: number,
  c_surf: number,
  c_max: number,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _T_K: number,
): number {
  return k * F * Math.sqrt(c_e * c_surf * (c_max - c_surf));
}

/** Butler-Volmer overpotential (arcsinh form) */
export function butlerVolmer(j: number, j0: number, T_K: number): number {
  if (j0 <= 1e-20) return 0;
  return (R_GAS * T_K / (ALPHA * F)) * Math.asinh(j / (2 * j0));
}

/**
 * Update bulk concentration via Euler integration with clamping.
 * Spherical particle mass balance: dc_avg/dt = 3·j / (R_p·F),
 * j = pore-wall flux density [A/m²], positive = insertion.
 */
export function updateBulkConc(
  c_avg: number,
  j: number,
  R_p: number,
  dt: number,
  c_max: number,
): number {
  const dc = 3 * j / (R_p * F);
  const updated = c_avg + dc * dt;
  return Math.max(c_max * 0.005, Math.min(c_max * 0.995, updated));
}
