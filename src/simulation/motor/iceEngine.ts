/** Yamaha MT-07 690cc torque curve [RPM, Nm] */
export const ICE_TORQUE_CURVE: [number, number][] = [
  [500, 51], [750, 51], [1000, 52], [1250, 53], [1500, 54], [1750, 55],
  [2000, 56], [2250, 57], [2500, 58], [2750, 59], [3000, 60], [3250, 61],
  [3500, 60.4], [3750, 61.8], [4000, 62.1], [4250, 62.4], [4500, 62.3],
  [4750, 63.4], [5000, 64.2], [5250, 65.5], [5500, 65.3], [5750, 65.5],
  [6000, 68.2], [6250, 68.5], [6500, 66.4], [6750, 66.0], [7000, 66.0],
  [7250, 66.2], [7500, 65.6], [7750, 64.7], [8000, 63.8], [8250, 62.5],
  [8500, 59.9], [8750, 57.9], [9000, 55.8], [9250, 54.4], [9500, 52.9],
  [9750, 51.5], [10000, 49.9], [10500, 46.7], [11000, 43.5],
];

/** Linear interpolation from torque curve */
export function interpICETorque(rpm: number, curve: [number, number][] = ICE_TORQUE_CURVE): number {
  if (rpm <= curve[0][0]) return curve[0][1];
  if (rpm >= curve[curve.length - 1][0]) return curve[curve.length - 1][1];
  for (let i = 1; i < curve.length; i++) {
    if (rpm <= curve[i][0]) {
      const t = (rpm - curve[i - 1][0]) / (curve[i][0] - curve[i - 1][0]);
      return curve[i - 1][1] + t * (curve[i][1] - curve[i - 1][1]);
    }
  }
  return 0;
}

/** Calculate ICE fuel consumption for a given power */
export function calcIceFuelStep(P_ice_W: number, bsfc: number, dt: number): number {
  // bsfc = g/kWh, P_ice_W in watts
  return (P_ice_W / 1000) * bsfc / 3600 * dt;
}
