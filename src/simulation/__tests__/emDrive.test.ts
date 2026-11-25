import { describe, it, expect } from 'vitest';
import {
  defaultEmDrive, emOperatingPoint, emCurrentLimit, emMaxWheelForce, emDerate,
  initEmThermal, stepEmThermal,
} from '../motor/emDrive';
import { kVtoKt } from '../motor/motorConstants';

const p = defaultEmDrive();
const r = 0.206;

describe('hub motor + ESC drive', () => {
  it('current limit = motor datasheet 7.5 Nm (≈ 82 A), not the 100 A ESC peak', () => {
    const I = emCurrentLimit(p, initEmThermal(25));
    expect(I * kVtoKt(p.kV)).toBeCloseTo(7.5, 6);
    expect(I).toBeLessThan(p.I_motor_max_A);
  });

  it('energy balance: P_elec = P_wheel + losses (motoring), P_elec = P_wheel − losses (regen)', () => {
    for (const F of [300, -300]) {
      const v = 15;
      const op = emOperatingPoint(p, F, v, 52, r);
      const P_gear = Math.abs(F * v) * (1 / p.eta_gear - 1) * (F > 0 ? 1 : p.eta_gear * p.eta_gear);
      const losses = p.n * (op.P_loss_motor_W + op.P_loss_esc_W);
      if (F > 0) expect(op.P_elec_W).toBeCloseTo(F * v + losses + Math.abs(F * v) * (1 / p.eta_gear - 1), 3);
      else expect(op.P_elec_W).toBeGreaterThan(F * v);   // less energy back than at the wheel
      expect(P_gear).toBeGreaterThan(0);
    }
  });

  it('efficiency 78–92 % at 90 km/h part load, lower at stall-like load', () => {
    const mid = emOperatingPoint(p, 150, 25, 52, r).eta;
    expect(mid).toBeGreaterThan(0.78);
    expect(mid).toBeLessThan(0.92);
    expect(emOperatingPoint(p, 600, 2, 52, r).eta).toBeLessThan(mid);
  });

  it('copper loss follows the datasheet Rm and rises with winding temperature', () => {
    const Kt = 60 / (2 * Math.PI * p.kV);
    const F = 2 * 5 * p.gear * p.eta_gear / r;   // 5 Nm per motor
    const cold = emOperatingPoint(p, F, 0.1, 52, r, 25);
    const hot = emOperatingPoint(p, F, 0.1, 52, r, 125);
    const I = 5 / Kt;
    expect(cold.P_loss_motor_W).toBeGreaterThan(0.086 * I * I);
    expect(cold.P_loss_motor_W).toBeLessThan(0.086 * I * I + 5);
    expect(hot.P_loss_motor_W / cold.P_loss_motor_W).toBeGreaterThan(1.35);
  });

  it('field weakening: no torque above no-load speed', () => {
    const v_nl = p.kV * 50 / p.gear * 2 * Math.PI / 60 * r;
    expect(emMaxWheelForce(p, v_nl * 1.01, 50, r, 80, true)).toBe(0);
  });

  it('VESC-style derating between 85 and 100 °C', () => {
    expect(emDerate(p, { ...initEmThermal(25), T_wind_C: 80 })).toBe(1);
    expect(emDerate(p, { ...initEmThermal(25), T_wind_C: 92.5 })).toBeCloseTo(0.5, 6);
    expect(emDerate(p, { ...initEmThermal(25), T_esc_C: 101 })).toBe(0);
  });

  it('thermal steady state: ESC → T_amb + P/G', () => {
    let st = initEmThermal(25);
    const op = { P_elec_W: 0, I_phase_A: 0, P_loss_motor_W: 0, P_loss_esc_W: 26, eta: 0 };
    for (let i = 0; i < 5000; i++) st = stepEmThermal(p, st, op, 0, 25, 1);
    expect(st.T_esc_C).toBeCloseTo(25 + 26 / p.G_esc_amb_WK, 1);
  });
});
