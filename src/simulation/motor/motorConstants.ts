/** Convert kV (RPM/V) to Kt (Nm/A) */
export function kVtoKt(kV_rpmV: number): number {
  // Kt = 60 / (2*pi*kV) = 9.5493 / kV
  return 60 / (2 * Math.PI * kV_rpmV);
}

/** Convert kV (RPM/V) to rad/s/V */
export function kVradFromKv(kV_rpmV: number): number {
  return kV_rpmV * 2 * Math.PI / 60;
}

/** Default motor config matching original FSO M06H */
export const DEFAULT_MOTOR = {
  Kt: 0.092,
  kV: 104,
  Rw: 0.08,
  eta_c: 0.96,
  eta_regen: 0.85,
  gear: 3.0,
  wheel_d_mm: 400,
  P_cont: 3.5,
  P_peak: 5.0,
  I_cont: 86,
  I_peak: 100,
  n: 2,
  mCp_m: 500,
  R_th_m: 0.5,
  eta_m: 0.88,
  mCp_e: 200,
  R_th_e: 0.3,
  T_amb: 25,
  T_warn_m: 80,
  T_warn_e: 70,
  soc_warn: 20,
  I_warn: 200,
  v_start: 0,
  v_target: 100,
  mass: 300,
  CdA: 0.40,
  Crr: 0.015,
  mu: 1.6,
  f_front: 0.45,
  h_cg: 0.30,
  wheelbase: 1.55,
  mass_acc: 300,
  Crr_acc: 0.015,
};
