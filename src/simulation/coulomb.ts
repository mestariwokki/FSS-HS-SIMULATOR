/** Coulomb counting SOC update */
export function stepSoc(
  _soc: number,
  soc0: number,
  ah: number,
  Q_eff_Ah: number,
): number {
  return Math.max(0, Math.min(1, soc0 - ah / Q_eff_Ah));
}

/** Energy integration for discharge/charge */
export function stepEnergy(
  wh_out: number,
  wh_in: number,
  I_bat: number,
  V_t: number,
  dt: number,
): { wh_out: number; wh_in: number } {
  const P_inst = I_bat * V_t;
  if (I_bat > 0) {
    return { wh_out: wh_out + P_inst * dt / 3600, wh_in };
  } else {
    return { wh_out, wh_in: wh_in + (-P_inst) * dt / 3600 };
  }
}
