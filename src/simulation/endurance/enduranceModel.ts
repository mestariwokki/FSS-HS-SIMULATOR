// enduranceModel uses direct parameters rather than config types

export interface SegmentResult {
  wh: number;
  time_s: number;
  distance_m: number;
}

/** Simulate acceleration segment (v0 -> v1) with energy budget */
export function simulateAccelSegment(
  v0_kmh: number,
  v1_kmh: number,
  mass_kg: number,
  CdA: number,
  Crr: number,
  eta_motor: number,
  eta_esc: number,
  P_peak_kW: number,
  n_motors: number,
  Kt: number,
  I_peak: number,
  gear: number,
  wheel_d_m: number,
  mu: number,
  f_front: number,
): SegmentResult {
  const v0 = v0_kmh / 3.6;
  const v1 = v1_kmh / 3.6;
  const dt = 0.05;
  const g = 9.81;
  const rho = 1.225;

  const F_trac_max = Kt * I_peak * gear * 0.97 * n_motors / (wheel_d_m / 2);
  const F_trac_lim = Math.min(F_trac_max, mass_kg * g * mu * f_front);

  let v = v0;
  let t = 0;
  let dist = 0;
  let E_Wh = 0;

  while (v < v1 - 0.1) {
    const F_net = Math.min(F_trac_lim, (P_peak_kW * 1000 * n_motors) / Math.max(v, 0.5))
      - (0.5 * rho * CdA * v * v + mass_kg * g * Crr);
    const a = Math.max(0, F_net / mass_kg);
    const dv = Math.min(a * dt, v1 - v);
    const P_motor_W = (0.5 * rho * CdA * v * v + mass_kg * g * Crr + mass_kg * a) * v;
    const P_bat_W = P_motor_W / (eta_motor * eta_esc);
    E_Wh += P_bat_W * dt / 3600;
    v += dv;
    t += dt;
    dist += v * dt;
    if (t > 60) break;
  }

  return { wh: E_Wh, time_s: t, distance_m: dist };
}

/** Simulate braking segment with regen */
export function simulateBrakeSegment(
  v0_kmh: number,
  v1_kmh: number,
  mass_kg: number,
  eta_regen: number,
  eta_esc: number,
): SegmentResult {
  const v0 = v0_kmh / 3.6;
  const v1 = v1_kmh / 3.6;
  const dE_kin = 0.5 * mass_kg * (v0 * v0 - v1 * v1);
  const E_regen_Wh = dE_kin * eta_regen / eta_esc / 3600;
  const a_brake = 15;
  const dist = (v0 * v0 - v1 * v1) / (2 * a_brake);
  const t = (v0 - v1) / a_brake;
  return { wh: -E_regen_Wh, time_s: t, distance_m: dist };
}

/** Simulate constant-speed corner segment */
export function simulateCornerSegment(
  v_kmh: number,
  dist_m: number,
  mass_kg: number,
  CdA: number,
  Crr: number,
  eta_motor: number,
  eta_esc: number,
): SegmentResult {
  const v = v_kmh / 3.6;
  const t = dist_m / v;
  const F_drag = 0.5 * 1.225 * CdA * v * v + mass_kg * 9.81 * Crr;
  const P_W = F_drag * v / (eta_motor * eta_esc);
  return { wh: P_W * t / 3600, time_s: t, distance_m: dist_m };
}
