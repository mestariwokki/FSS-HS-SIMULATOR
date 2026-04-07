// vehicleDynamics uses direct parameters rather than VehicleConfig

export interface AccelStepResult {
  v_ms: number;
  x_m: number;
  a: number;
}

export function calcAccelStep(
  v_ms: number,
  F_trac: number,
  mass_kg: number,
  CdA: number,
  Crr: number,
  dt: number,
  v_target_ms?: number,
): AccelStepResult {
  const F_drag = 0.5 * 1.225 * CdA * v_ms * v_ms;
  const F_roll = Crr * mass_kg * 9.81;
  const a = Math.max(0, F_trac - F_drag - F_roll) / mass_kg;

  let new_v = v_ms + a * dt;
  if (v_target_ms !== undefined) {
    new_v = Math.min(v_target_ms, new_v);
  }
  const x = v_ms * dt + 0.5 * a * dt * dt;

  return { v_ms: new_v, x_m: x, a };
}

export function dragForce(v_ms: number, CdA: number, Crr: number, mass_kg: number): number {
  return 0.5 * 1.225 * CdA * v_ms * v_ms + mass_kg * 9.81 * Crr;
}
