import { describe, it, expect } from 'vitest';
import { stepSoc, stepEnergy } from '../coulomb';

describe('stepSoc — Coulomb counting', () => {
  it('SOC decreases when discharging (positive current)', () => {
    // After drawing 6.6 Ah from a 6.6 Ah pack: SOC = 0
    const soc = stepSoc(1.0, 1.0, 6.6, 6.6);
    expect(soc).toBeCloseTo(0.0, 4);
  });

  it('SOC increases when charging (ah goes negative)', () => {
    const soc = stepSoc(0.5, 0.5, -3.3, 6.6);
    expect(soc).toBeCloseTo(1.0, 4);
  });

  it('clamps SOC to [0, 1]', () => {
    expect(stepSoc(0, 0, 999, 6.6)).toBe(0);
    expect(stepSoc(1, 0, -999, 6.6)).toBe(1);
  });

  it('half capacity used = 50% SOC drop', () => {
    const soc = stepSoc(1.0, 1.0, 3.3, 6.6);
    expect(soc).toBeCloseTo(0.5, 4);
  });

  it('uses effective capacity not nominal (SoH degradation)', () => {
    // At 80% SoH: Q_eff = 6.6 * 0.8 = 5.28 Ah
    const Q_eff = 6.6 * 0.8;
    const soc = stepSoc(1.0, 1.0, Q_eff, Q_eff);
    expect(soc).toBeCloseTo(0.0, 4);
  });
});

describe('stepEnergy', () => {
  it('discharge (I > 0) increments wh_out only', () => {
    const { wh_out, wh_in } = stepEnergy(0, 0, 100, 50, 3600);
    // P = 100*50 = 5000W, dt=3600s → 5000 Wh
    expect(wh_out).toBeCloseTo(5000, 2);
    expect(wh_in).toBe(0);
  });

  it('charge (I < 0) increments wh_in only', () => {
    const { wh_out, wh_in } = stepEnergy(0, 0, -13, 50, 3600);
    expect(wh_in).toBeCloseTo(13 * 50, 2);
    expect(wh_out).toBe(0);
  });

  it('accumulates correctly over multiple steps', () => {
    let wh_out = 0, wh_in = 0;
    const dt = 0.1;
    // 250 A for 10 s at 45 V → 250*45*10/3600 Wh
    for (let i = 0; i < 100; i++) {
      ({ wh_out, wh_in } = stepEnergy(wh_out, wh_in, 250, 45, dt));
    }
    expect(wh_out).toBeCloseTo(250 * 45 * 10 / 3600, 2);
    expect(wh_in).toBe(0);
  });

  it('I=0 returns unchanged values', () => {
    const { wh_out, wh_in } = stepEnergy(1.5, 0.3, 0, 45, 0.1);
    expect(wh_out).toBe(1.5);
    expect(wh_in).toBe(0.3);
  });
});
