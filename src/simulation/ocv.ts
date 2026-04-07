import { X_POS_0, X_POS_100, X_NEG_0, X_NEG_100, C_MAX_POS, C_MAX_NEG } from './constants';

/** LiCoO2 positive electrode OCP - Ramadass2004 rational polynomial */
export function U_pos(x: number): number {
  x = Math.max(0.001, Math.min(0.999, x));
  const u = -4.656 + 88.669 * x - 401.119 * x ** 2 + 342.909 * x ** 3 - 462.471 * x ** 4 + 433.434 * x ** 5;
  const d = -1 + 18.933 * x - 79.532 * x ** 2 + 37.311 * x ** 3 - 73.083 * x ** 4 + 95.960 * x ** 5;
  return Math.max(3.4, Math.min(4.5, u / d));
}

/** Graphite negative electrode OCP - Dualfoil1998 fit */
export function U_neg(x: number): number {
  x = Math.max(0.001, Math.min(0.999, x));
  return (
    0.7222 +
    0.1387 * x +
    0.029 * x ** 0.5 -
    0.0172 / x +
    1.5e-4 / x ** 1.5 +
    0.2808 * Math.exp(0.9 - 15 * x) -
    0.7984 * Math.exp(0.4465 * x - 0.4108)
  );
}

/** Single cell OCV from SOC [0..1] */
export function ocvCell(soc: number): number {
  const s = Math.max(0, Math.min(1, soc));
  const xp = X_POS_0 + (X_POS_100 - X_POS_0) * s;
  const xn = X_NEG_0 + (X_NEG_100 - X_NEG_0) * s;
  return U_pos(xp) - U_neg(xn);
}

/** Pack OCV from SOC [0..1] */
export function ocvPack(soc: number, series: number): number {
  return ocvCell(soc) * series;
}

/** Get stoichiometry from SOC */
export function stoichiometryFromSoc(soc: number): { xp: number; xn: number } {
  const s = Math.max(0, Math.min(1, soc));
  return {
    xp: X_POS_0 + (X_POS_100 - X_POS_0) * s,
    xn: X_NEG_0 + (X_NEG_100 - X_NEG_0) * s,
  };
}

/** Get initial bulk concentrations from SOC */
export function initialConcentrations(soc: number): { c_avg_pos: number; c_avg_neg: number } {
  const { xp, xn } = stoichiometryFromSoc(soc);
  return {
    c_avg_pos: C_MAX_POS * xp,
    c_avg_neg: C_MAX_NEG * xn,
  };
}
