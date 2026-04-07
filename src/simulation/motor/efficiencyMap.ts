import type { MotorConfig, PackConfig, EffMapPoint } from '../../types';
import { kVradFromKv } from './motorConstants';

export function calcEffMap(
  mc: MotorConfig,
  pack: PackConfig,
  nx: number = 80,
  ny: number = 50,
): EffMapPoint[][] {
  const kV_rad = kVradFromKv(mc.kV_rpmV);
  const rpm_max = mc.kV_rpmV * pack.v_nom;
  const T_max = mc.Kt_NmA * mc.I_peak_A * 1.05;

  const grid: EffMapPoint[][] = [];

  for (let ix = 0; ix < nx; ix++) {
    const row: EffMapPoint[] = [];
    const rpm = (ix + 0.5) / nx * rpm_max;
    const omega = rpm * 2 * Math.PI / 60;
    const V_bemf = omega / kV_rad;

    for (let iy = 0; iy < ny; iy++) {
      const T_motor = (1 - (iy + 0.5) / ny) * T_max;
      const I_motor = T_motor / mc.Kt_NmA;

      const valid = I_motor <= mc.I_peak_A &&
        V_bemf + I_motor * mc.R_winding_Ohm <= pack.v_max &&
        V_bemf <= pack.v_nom;

      if (!valid) {
        row.push({ rpm, torque_Nm: T_motor, eta: 0, P_mech_kW: 0, I_motor_A: I_motor, valid: false });
        continue;
      }

      const P_mech = T_motor * omega * mc.n_motors;
      const P_bat = (V_bemf * I_motor + I_motor * I_motor * mc.R_winding_Ohm) * mc.n_motors / mc.eta_esc;
      const eta = P_bat > 0.1 ? P_mech / P_bat : 0;

      row.push({
        rpm,
        torque_Nm: T_motor,
        eta: Math.max(0, Math.min(1, eta)),
        P_mech_kW: P_mech / 1000,
        I_motor_A: I_motor,
        valid: true,
      });
    }
    grid.push(row);
  }

  return grid;
}

/** Efficiency map color palette: dark -> red -> yellow -> green */
export function etaColor(eta: number): string {
  eta = Math.max(0, Math.min(1, eta));
  if (eta < 0.55) return 'rgba(30,10,10,0.98)';
  if (eta < 0.70) {
    const t = (eta - 0.55) / 0.15;
    return `rgb(${Math.round(180 + t * 75)},${Math.round(30 + t * 60)},30)`;
  }
  if (eta < 0.85) {
    const t = (eta - 0.70) / 0.15;
    return `rgb(${Math.round(255 - t * 135)},${Math.round(90 + t * 100)},30)`;
  }
  const t = (eta - 0.85) / 0.15;
  return `rgb(${Math.round(120 - t * 80)},${Math.round(190 + t * 40)},${Math.round(30 + t * 50)})`;
}
