import { describe, it, expect } from 'vitest';
import {
  r0Cell, r1Cell, r2Cell,
  r0TempCorrect,
  step2RC, terminalVoltage,
  battery2RCStep,
  packMaxPowerW,
  TAU1_S, TAU2_S,
} from '../battery';
import { CELL_R_AC_TYP_OHM } from '../cellData';

describe('r0Cell / r1Cell / r2Cell — EP9343126VVP lookup', () => {
  it('r0 is highest at low SOC', () => {
    expect(r0Cell(0.20)).toBeGreaterThan(r0Cell(1.00));
  });

  it('13S2P pack R0 at 50 % SOC is ≈ 24 mΩ', () => {
    expect(r0Cell(0.50) * 13 / 2).toBeCloseTo(0.024, 3);
  });

  it('DC r0 is above the datasheet 1 kHz AC value but within 2.5×', () => {
    for (const s of [0.2, 0.5, 1.0]) {
      expect(r0Cell(s)).toBeGreaterThan(CELL_R_AC_TYP_OHM);
      expect(r0Cell(s)).toBeLessThan(2.5 * CELL_R_AC_TYP_OHM);
    }
  });

  it('RC resistances are smaller than r0 (power cell)', () => {
    for (const s of [0.2, 0.5, 1.0]) {
      expect(r1Cell(s)).toBeLessThan(r0Cell(s));
      expect(r2Cell(s)).toBeLessThan(r0Cell(s));
    }
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

describe('packMaxPowerW — cell current limit', () => {
  it('13S2P at 80 % SOC is limited by 198 A, not by matched impedance', () => {
    const P = packMaxPowerW(0.8, 0, 0, 13, 2, 25);
    // ≈ (V_oc − 198·R0)·198 ≈ 10 kW, far below V²/4R ≈ 35 kW
    expect(P).toBeLessThan(198 * 13 * 4.2);
    expect(P).toBeGreaterThan(9000);
  });

  it('custom current limit is respected', () => {
    const P100 = packMaxPowerW(0.8, 0, 0, 13, 2, 25, 100);
    expect(P100).toBeLessThan(100 * 13 * 4.2);
  });
});
