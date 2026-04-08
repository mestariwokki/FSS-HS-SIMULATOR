/**
 * FSO Yamaha torque curve [RPM, Nm]
 * Calibrated from dyno measurements (Finger Motors OY, 2025-07-28):
 *   Peak torque: 80 Nm @ 5671 RPM
 *   Peak power:  83 HP (61.9 kW) @ 9703 RPM → implied 60.9 Nm @ 9703 RPM
 * Curve shape interpolated between measured anchors.
 */
export const ICE_TORQUE_CURVE: [number, number][] = [
  [500, 50.0], [1000, 53.0], [1500, 57.0], [2000, 61.0], [2500, 65.0],
  [3000, 68.0], [3500, 71.0], [4000, 74.0], [4500, 76.0], [5000, 78.0],
  [5500, 79.5], [5671, 80.0], [6000, 79.0], [6500, 77.0], [7000, 74.0],
  [7500, 72.0], [8000, 69.0], [8500, 66.0], [9000, 63.5], [9500, 61.5],
  [9703, 60.9], [10000, 59.0], [10500, 56.0], [11000, 52.0],
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
