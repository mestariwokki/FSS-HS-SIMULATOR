/** Calculate State of Health from cycle count */
export function calcSoH(
  cycles: number,
  kQ: number,
  kR: number,
): { soh_cap: number; soh_res: number } {
  return {
    soh_cap: Math.max(0.50, 1.0 - kQ * cycles),
    soh_res: 1.0 + kR * cycles,
  };
}

/** Step a single RC element using exact exponential discretization */
export function stepRC(
  V_RC: number,
  I_pack: number,
  R_pack: number,
  tau: number,
  dt: number,
): number {
  const alpha = Math.exp(-dt / tau);
  return V_RC * alpha + I_pack * R_pack * (1.0 - alpha);
}
