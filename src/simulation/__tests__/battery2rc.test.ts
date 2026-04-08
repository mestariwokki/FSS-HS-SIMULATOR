import { describe, it, expect } from 'vitest';
import {
  r0Cell, r1Cell, r2Cell,
  r0TempCorrect,
  step2RC, terminalVoltage,
  battery2RCStep,
  TAU1_S, TAU2_S,
} from '../battery';

describe('r0Cell / r1Cell / r2Cell — NMC lookup', () => {
  it('r0 is highest at low SOC and lowest at high SOC', () => {
    expect(r0Cell(0.20)).toBeGreaterThan(r0Cell(1.00));
  });

  it('r0 at SOC=1.0 is 15 mΩ', () => {
    expect(r0Cell(1.00)).toBeCloseTo(0.015, 4);
  });

  it('r0 at SOC=0.20 is 35 mΩ', () => {
    expect(r0Cell(0.20)).toBeCloseTo(0.035, 4);
  });

  it('r1 at SOC=1.0 is 5 mΩ', () => {
    expect(r1Cell(1.00)).toBeCloseTo(0.005, 4);
  });

  it('r2 at SOC=0.20 is 8 mΩ', () => {
    expect(r2Cell(0.20)).toBeCloseTo(0.008, 4);
  });

  it('clamps SOC below 0.20 to 0.20 value', () => {
    expect(r0Cell(0.0)).toBeCloseTo(r0Cell(0.20), 6);
  });

  it('clamps SOC above 1.0 to 1.0 value', () => {
    expect(r0Cell(1.5)).toBeCloseTo(r0Cell(1.00), 6);
  });
});

describe('r0TempCorrect — Arrhenius correction', () => {
  it('returns unchanged value at 25 °C', () => {
    expect(r0TempCorrect(0.020, 25)).toBeCloseTo(0.020, 6);
  });

  it('increases resistance below 25 °C', () => {
    expect(r0TempCorrect(0.020, 0)).toBeGreaterThan(0.020);
  });

  it('decreases resistance above 25 °C', () => {
    expect(r0TempCorrect(0.020, 45)).toBeLessThan(0.020);
  });

  it('matches expected value at 0 °C: r0*exp(0.04*25)', () => {
    const r0 = 0.020;
    const expected = r0 * Math.exp(0.04 * 25);
    expect(r0TempCorrect(r0, 0)).toBeCloseTo(expected, 6);
  });
});

describe('step2RC — exponential discretization', () => {
  it('RC1 converges to I*R1 in steady state', () => {
    const I = 10;
    const R1 = 0.01;
    const R2 = 0.005;
    const dt = 0.1;
    let [v1, v2] = [0, 0];
    for (let i = 0; i < 5000; i++) {
      [v1, v2] = step2RC(v1, v2, I, R1, R2, dt);
    }
    expect(v1).toBeCloseTo(I * R1, 3);
    expect(v2).toBeCloseTo(I * R2, 3);
  });

  it('RC1 satisfies exact solution at t = τ1', () => {
    const I = 5;
    const R1 = 0.02;
    const R2 = 0.01;
    const dt = 0.01;
    const steps = Math.round(TAU1_S / dt);
    let [v1, v2] = [0, 0];
    for (let i = 0; i < steps; i++) {
      [v1, v2] = step2RC(v1, v2, I, R1, R2, dt);
    }
    // After one τ1: V_rc1 = I*R1*(1 - e⁻¹) ≈ 0.6321 * I*R1
    expect(v1).toBeCloseTo(I * R1 * (1 - Math.exp(-1)), 2);
  });

  it('RC2 satisfies exact solution at t = τ2', () => {
    const I = 8;
    const R2 = 0.006;
    const dt = 0.01;
    const steps = Math.round(TAU2_S / dt);
    let [v1, v2] = [0, 0];
    for (let i = 0; i < steps; i++) {
      [v1, v2] = step2RC(v1, v2, I, 0, R2, dt);
    }
    expect(v2).toBeCloseTo(I * R2 * (1 - Math.exp(-1)), 2);
  });

  it('decays to zero when current removed', () => {
    let [v1, v2] = [0.5, 0.3];
    const dt = 0.1;
    for (let i = 0; i < 3000; i++) {
      [v1, v2] = step2RC(v1, v2, 0, 0.01, 0.005, dt);
    }
    expect(v1).toBeCloseTo(0, 3);
    expect(v2).toBeCloseTo(0, 3);
  });
});

describe('terminalVoltage', () => {
  it('equals V_oc when idle (I=0, V_rc=0)', () => {
    expect(terminalVoltage(48, 0, 0.1, 0, 0)).toBeCloseTo(48, 6);
  });

  it('drops by I*R0 + V_rc1 + V_rc2 under load', () => {
    const V_oc = 48;
    const I = 10;
    const R0 = 0.05;
    const V_rc1 = 0.05;
    const V_rc2 = 0.02;
    const expected = V_oc - I * R0 - V_rc1 - V_rc2;
    expect(terminalVoltage(V_oc, I, R0, V_rc1, V_rc2)).toBeCloseTo(expected, 6);
  });
});

describe('battery2RCStep — integration', () => {
  it('returns positive current for positive power demand', () => {
    const r = battery2RCStep(0.8, 0, 0, 0, 13, 1, 13.2, 25, 1000, 0.05);
    expect(r.I_bat).toBeGreaterThan(0);
  });

  it('SOC decreases with positive current', () => {
    const r = battery2RCStep(0.8, 0, 0, 0, 13, 1, 13.2, 25, 1000, 1.0);
    expect(r.soc_new).toBeLessThan(0.8);
  });

  it('wh_em increases with positive current', () => {
    const r = battery2RCStep(0.8, 0, 0, 0, 13, 1, 13.2, 25, 1000, 1.0);
    expect(r.wh_new).toBeGreaterThan(0);
  });

  it('V_rc1 and V_rc2 build up from zero under constant current', () => {
    let V_rc1 = 0;
    let V_rc2 = 0;
    let wh = 0;
    let soc = 0.8;
    for (let i = 0; i < 100; i++) {
      const r = battery2RCStep(soc, wh, V_rc1, V_rc2, 13, 1, 13.2, 25, 500, 0.1);
      ({ V_rc1, V_rc2, wh_new: wh, soc_new: soc } = { ...r, wh_new: r.wh_new });
    }
    expect(V_rc1).toBeGreaterThan(0);
    expect(V_rc2).toBeGreaterThan(0);
  });

  it('SOC never drops below 0.005', () => {
    // Extreme discharge
    const r = battery2RCStep(0.001, 0, 0, 0, 13, 1, 0.1, 25, 100000, 3600);
    expect(r.soc_new).toBeGreaterThanOrEqual(0.005);
  });

  it('cold temperature (higher R0) draws more current for same power', () => {
    // Higher R0 → more ohmic loss → more current needed to deliver same terminal power
    const hot = battery2RCStep(0.8, 0, 0, 0, 13, 1, 13.2, 45, 1000, 0.05);
    const cold = battery2RCStep(0.8, 0, 0, 0, 13, 1, 13.2, 5, 1000, 0.05);
    expect(cold.I_bat).toBeGreaterThan(hot.I_bat);
  });
});
