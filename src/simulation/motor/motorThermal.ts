export interface MotorThermalResult {
  T_motor: number;
  T_esc: number;
}

export function stepMotorThermal(
  T_motor: number,
  T_esc: number,
  P_bat_W: number,
  eta_motor: number,
  eta_esc: number,
  mCp_m: number,
  Rth_m: number,
  mCp_e: number,
  Rth_e: number,
  dt: number,
  T_amb: number,
  is_regen: boolean,
): MotorThermalResult {
  const P_loss_m = Math.max(0, is_regen ? 0 : P_bat_W * (1 - eta_motor));
  const P_loss_e = Math.max(0, is_regen ? 0 : P_bat_W * (1 - eta_esc));

  const T_motor_new = Math.max(T_amb,
    T_motor + (P_loss_m - (T_motor - T_amb) / Rth_m) / mCp_m * dt);
  const T_esc_new = Math.max(T_amb,
    T_esc + (P_loss_e - (T_esc - T_amb) / Rth_e) / mCp_e * dt);

  return { T_motor: T_motor_new, T_esc: T_esc_new };
}
