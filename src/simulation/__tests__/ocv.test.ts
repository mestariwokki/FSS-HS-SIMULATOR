import { describe, it, expect } from 'vitest';
import { U_pos, U_neg, ocvCell, ocvPack, stoichiometryFromSoc, initialConcentrations } from '../ocv';
import { C_MAX_POS, C_MAX_NEG, X_POS_0, X_POS_100, X_NEG_0, X_NEG_100 } from '../constants';

describe('U_pos — LiCoO2 positive OCV', () => {
  it('returns physically plausible voltage range [3.4–4.5 V]', () => {
    for (const x of [0.1, 0.3, 0.5, 0.7, 0.9]) {
      const v = U_pos(x);
      expect(v).toBeGreaterThanOrEqual(3.4);
      expect(v).toBeLessThanOrEqual(4.5);
    }
  });

  it('decreases monotonically as x increases (Li intercalation = delithiation)', () => {
    const xs = [0.5, 0.6, 0.7, 0.8, 0.95];
    for (let i = 1; i < xs.length; i++) {
      expect(U_pos(xs[i])).toBeLessThan(U_pos(xs[i - 1]));
    }
  });

  it('clamps input to [0.001, 0.999] — no NaN or infinity', () => {
    expect(isFinite(U_pos(0))).toBe(true);
    expect(isFinite(U_pos(1))).toBe(true);
    expect(isFinite(U_pos(-0.5))).toBe(true);
    expect(isFinite(U_pos(1.5))).toBe(true);
  });
});

describe('U_neg — graphite negative OCV', () => {
  it('returns physically plausible voltage range [0–0.9 V]', () => {
    for (const x of [0.1, 0.3, 0.5, 0.7, 0.9]) {
      const v = U_neg(x);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(0.9);
    }
  });

  it('increases as x decreases (graphite discharges when delithiated)', () => {
    // higher x = more Li in graphite = lower potential
    expect(U_neg(0.8)).toBeLessThan(U_neg(0.2));
  });

  it('clamps safely at boundaries', () => {
    expect(isFinite(U_neg(0))).toBe(true);
    expect(isFinite(U_neg(1))).toBe(true);
  });
});

describe('ocvCell', () => {
  it('at SOC=1 (full) returns ~3.8–4.3 V for LiCoO2/graphite (stoichiometry endpoints)', () => {
    const v = ocvCell(1.0);
    expect(v).toBeGreaterThan(3.7);
    expect(v).toBeLessThan(4.5);
  });

  it('at SOC=0 (empty) returns ~3.0–3.8 V', () => {
    const v = ocvCell(0.0);
    expect(v).toBeGreaterThan(2.8);
    expect(v).toBeLessThan(3.8);
  });

  it('is monotonically increasing with SOC', () => {
    const socs = [0.0, 0.2, 0.4, 0.6, 0.8, 1.0];
    for (let i = 1; i < socs.length; i++) {
      expect(ocvCell(socs[i])).toBeGreaterThan(ocvCell(socs[i - 1]));
    }
  });

  it('clamps SOC input — no NaN', () => {
    expect(isFinite(ocvCell(-0.1))).toBe(true);
    expect(isFinite(ocvCell(1.5))).toBe(true);
  });
});

describe('ocvPack', () => {
  it('scales linearly with series count', () => {
    const cell = ocvCell(0.5);
    expect(ocvPack(0.5, 13)).toBeCloseTo(cell * 13, 6);
    expect(ocvPack(0.5, 1)).toBeCloseTo(cell, 6);
  });
});

describe('stoichiometryFromSoc', () => {
  it('at SOC=0 returns x_pos=X_POS_0, x_neg=X_NEG_0', () => {
    const { xp, xn } = stoichiometryFromSoc(0);
    expect(xp).toBeCloseTo(X_POS_0, 6);
    expect(xn).toBeCloseTo(X_NEG_0, 6);
  });

  it('at SOC=1 returns x_pos=X_POS_100, x_neg=X_NEG_100', () => {
    const { xp, xn } = stoichiometryFromSoc(1);
    expect(xp).toBeCloseTo(X_POS_100, 6);
    expect(xn).toBeCloseTo(X_NEG_100, 6);
  });

  it('interpolates linearly at SOC=0.5', () => {
    const { xp, xn } = stoichiometryFromSoc(0.5);
    expect(xp).toBeCloseTo((X_POS_0 + X_POS_100) / 2, 6);
    expect(xn).toBeCloseTo((X_NEG_0 + X_NEG_100) / 2, 6);
  });
});

describe('initialConcentrations', () => {
  it('at SOC=1 gives max concentrations scaled to X_POS_100/X_NEG_100', () => {
    const { c_avg_pos, c_avg_neg } = initialConcentrations(1.0);
    expect(c_avg_pos).toBeCloseTo(C_MAX_POS * X_POS_100, 1);
    expect(c_avg_neg).toBeCloseTo(C_MAX_NEG * X_NEG_100, 1);
  });

  it('produces positive concentrations for all SOC', () => {
    for (const soc of [0, 0.25, 0.5, 0.75, 1.0]) {
      const { c_avg_pos, c_avg_neg } = initialConcentrations(soc);
      expect(c_avg_pos).toBeGreaterThan(0);
      expect(c_avg_neg).toBeGreaterThan(0);
    }
  });
});
