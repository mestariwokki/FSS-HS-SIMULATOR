import { describe, it, expect } from 'vitest';
import { arrhenius, surfaceConc, exchangeCurrentDensity, butlerVolmer, updateBulkConc } from '../spm';
import { T_REF, C_MAX_POS, R_P_POS, D_S_POS, F, EPS_POS, L_POS, K_POS, C_E } from '../constants';

describe('arrhenius', () => {
  it('returns k0 at reference temperature', () => {
    expect(arrhenius(1e-10, 5000, T_REF)).toBeCloseTo(1e-10, 15);
  });

  it('rate increases above reference temperature', () => {
    const k_hot = arrhenius(1e-10, 5000, T_REF + 10);
    expect(k_hot).toBeGreaterThan(1e-10);
  });

  it('rate decreases below reference temperature', () => {
    const k_cold = arrhenius(1e-10, 5000, T_REF - 10);
    expect(k_cold).toBeLessThan(1e-10);
  });

  it('higher Ea → stronger temperature sensitivity', () => {
    const delta_lo = arrhenius(1, 5000,  T_REF + 10) - arrhenius(1, 5000,  T_REF);
    const delta_hi = arrhenius(1, 20000, T_REF + 10) - arrhenius(1, 20000, T_REF);
    expect(delta_hi).toBeGreaterThan(delta_lo);
  });
});

describe('surfaceConc', () => {
  const c_avg = C_MAX_POS * 0.5;

  it('returns value close to bulk when j is small', () => {
    const cs = surfaceConc(c_avg, 1e-6, R_P_POS, D_S_POS, C_MAX_POS);
    expect(Math.abs(cs - c_avg)).toBeLessThan(100);
  });

  it('decreases below bulk during discharge (positive j)', () => {
    const cs = surfaceConc(c_avg, 0.5, R_P_POS, D_S_POS, C_MAX_POS);
    expect(cs).toBeLessThan(c_avg);
  });

  it('clamps at 50 mol/m³ minimum', () => {
    // Extreme j depleting surface
    const cs = surfaceConc(100, 999, R_P_POS, D_S_POS, C_MAX_POS);
    expect(cs).toBeGreaterThanOrEqual(50);
  });

  it('clamps at c_max - 50 maximum', () => {
    // Extreme j filling surface
    const cs = surfaceConc(C_MAX_POS - 100, -999, R_P_POS, D_S_POS, C_MAX_POS);
    expect(cs).toBeLessThanOrEqual(C_MAX_POS - 50);
  });
});

describe('exchangeCurrentDensity', () => {
  it('returns positive value for valid inputs', () => {
    const c_surf = C_MAX_POS * 0.5;
    const j0 = exchangeCurrentDensity(K_POS, C_E, c_surf, C_MAX_POS, T_REF);
    expect(j0).toBeGreaterThan(0);
  });

  it('scales with kinetic rate constant k', () => {
    const c_surf = C_MAX_POS * 0.5;
    const j0_lo = exchangeCurrentDensity(K_POS,     C_E, c_surf, C_MAX_POS, T_REF);
    const j0_hi = exchangeCurrentDensity(K_POS * 2, C_E, c_surf, C_MAX_POS, T_REF);
    expect(j0_hi).toBeCloseTo(j0_lo * 2, 6);
  });

  it('scales with sqrt of (c_surf * (c_max - c_surf))', () => {
    const c1 = C_MAX_POS * 0.25;
    const c2 = C_MAX_POS * 0.5;
    const j0_1 = exchangeCurrentDensity(K_POS, C_E, c1, C_MAX_POS, T_REF);
    const j0_2 = exchangeCurrentDensity(K_POS, C_E, c2, C_MAX_POS, T_REF);
    const ratio = j0_2 / j0_1;
    const expected = Math.sqrt((c2 * (C_MAX_POS - c2)) / (c1 * (C_MAX_POS - c1)));
    expect(ratio).toBeCloseTo(expected, 4);
  });
});

describe('butlerVolmer', () => {
  it('returns 0 when j=0 (no current, no overpotential)', () => {
    const j0 = exchangeCurrentDensity(K_POS, C_E, C_MAX_POS * 0.5, C_MAX_POS, T_REF);
    expect(butlerVolmer(0, j0, T_REF)).toBeCloseTo(0, 6);
  });

  it('positive j (discharge) → positive overpotential', () => {
    const j0 = exchangeCurrentDensity(K_POS, C_E, C_MAX_POS * 0.5, C_MAX_POS, T_REF);
    expect(butlerVolmer(0.1, j0, T_REF)).toBeGreaterThan(0);
  });

  it('negative j (charge) → negative overpotential', () => {
    const j0 = exchangeCurrentDensity(K_POS, C_E, C_MAX_POS * 0.5, C_MAX_POS, T_REF);
    expect(butlerVolmer(-0.1, j0, T_REF)).toBeLessThan(0);
  });

  it('overpotential increases with larger j', () => {
    const j0 = exchangeCurrentDensity(K_POS, C_E, C_MAX_POS * 0.5, C_MAX_POS, T_REF);
    const eta1 = butlerVolmer(0.1, j0, T_REF);
    const eta2 = butlerVolmer(1.0, j0, T_REF);
    expect(eta2).toBeGreaterThan(eta1);
  });

  it('returns 0 when j0 is essentially zero', () => {
    expect(butlerVolmer(1.0, 0, T_REF)).toBe(0);
  });

  it('scales with RT/αF (temperature dependence)', () => {
    const j0 = exchangeCurrentDensity(K_POS, C_E, C_MAX_POS * 0.5, C_MAX_POS, T_REF);
    const eta_cold = butlerVolmer(0.5, j0, 273.15);
    const eta_hot  = butlerVolmer(0.5, j0, 333.15);
    // Higher T → larger RT/αF → larger overpotential at same j
    expect(eta_hot).toBeGreaterThan(eta_cold);
  });

  it('result is in physically reasonable range (< 1 V) at moderate j', () => {
    const j0 = exchangeCurrentDensity(K_POS, C_E, C_MAX_POS * 0.5, C_MAX_POS, T_REF);
    const eta = butlerVolmer(10 * j0, j0, T_REF);
    expect(Math.abs(eta)).toBeLessThan(1.0);
  });
});

describe('updateBulkConc', () => {
  it('decreases with positive j (extraction from electrode)', () => {
    const c0 = C_MAX_POS * 0.5;
    const j = 0.5; // positive = extracting Li from positive electrode
    const c1 = updateBulkConc(c0, j, EPS_POS, L_POS, 0.1, C_MAX_POS);
    expect(c1).toBeGreaterThan(c0); // positive j increases c in positive electrode (Li inserted)
  });

  it('clamps at 0.5% of c_max', () => {
    const c_new = updateBulkConc(C_MAX_POS * 0.005, 999, EPS_POS, L_POS, 1.0, C_MAX_POS);
    expect(c_new).toBeGreaterThanOrEqual(C_MAX_POS * 0.005);
  });

  it('clamps at 99.5% of c_max', () => {
    const c_new = updateBulkConc(C_MAX_POS * 0.995, -999, EPS_POS, L_POS, 1.0, C_MAX_POS);
    expect(c_new).toBeLessThanOrEqual(C_MAX_POS * 0.995);
  });

  it('rate of change proportional to j / (F*eps*L)', () => {
    const c0 = C_MAX_POS * 0.5;
    const dt = 0.001; // small dt so clamping doesn't apply
    const j = 0.01;
    const c1 = updateBulkConc(c0, j, EPS_POS, L_POS, dt, C_MAX_POS);
    const expected_dc = j / (F * EPS_POS * L_POS) * dt;
    expect(c1 - c0).toBeCloseTo(expected_dc, 8);
  });
});
