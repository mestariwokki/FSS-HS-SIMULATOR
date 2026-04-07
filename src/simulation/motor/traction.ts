// traction uses direct parameters rather than VehicleConfig

export interface TractionResult {
  F_el_max: number;
  F_rear_max: number;
}

/** Calculate traction-limited forces with dynamic axle load transfer */
export function tractionLimit(
  a_prev: number,
  mass_kg: number,
  mu: number,
  f_front: number,
  h_cg: number,
  wheelbase: number,
): TractionResult {
  const mg = mass_kg * 9.81;
  const N_f = Math.max(0, mg * f_front - mass_kg * a_prev * h_cg / wheelbase);
  const N_r = Math.max(0, mg * (1 - f_front) + mass_kg * a_prev * h_cg / wheelbase);
  return {
    F_el_max: mu * N_f,
    F_rear_max: mu * N_r,
  };
}
