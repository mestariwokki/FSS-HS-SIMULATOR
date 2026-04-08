import { describe, it, expect } from 'vitest';
import { calcSoH, stepRC } from '../ecm';

describe('calcSoH', () => {
  it('at 0 cycles returns soh_cap=1.0, soh_res=1.0', () => {
    const { soh_cap, soh_res } = calcSoH(0, 1.5e-4, 4.0e-4);
    expect(soh_cap).toBe(1.0);
    expect(soh_res).toBe(1.0);
  });

  it('capacity degrades with cycles', () => {
    const { soh_cap } = calcSoH(1000, 1.5e-4, 4.0e-4);
    expect(soh_cap).toBeCloseTo(1.0 - 1.5e-4 * 1000, 6);
    expect(soh_cap).toBeLessThan(1.0);
  });

  it('resistance grows with cycles', () => {
    const { soh_res } = calcSoH(1000, 1.5e-4, 4.0e-4);
    expect(soh_res).toBeCloseTo(1.0 + 4.0e-4 * 1000, 6);
    expect(soh_res).toBeGreaterThan(1.0);
  });

  it('clamps soh_cap to minimum 0.5', () => {
    const { soh_cap } = calcSoH(99999, 1.5e-4, 4.0e-4);
    expect(soh_cap).toBeGreaterThanOrEqual(0.5);
  });

  it('soh_res never falls below 1.0', () => {
    const { soh_res } = calcSoH(0, 1.5e-4, 4.0e-4);
    expect(soh_res).toBeGreaterThanOrEqual(1.0);
  });
});

describe('stepRC — exponential discretization', () => {
  it('decays to zero from initial value with no current', () => {
    let V = 1.0;
    const dt = 0.1;
    const tau = 5.0;
    for (let i = 0; i < 1000; i++) {
      V = stepRC(V, 0, 0.01, tau, dt);
    }
    expect(V).toBeCloseTo(0, 4);
  });

  it('converges to steady-state I*R with constant current', () => {
    const I = 10; // A
    const R = 0.01; // Ω
    const tau = 5;
    const dt = 0.1;
    let V = 0;
    for (let i = 0; i < 2000; i++) {
      V = stepRC(V, I, R, tau, dt);
    }
    // Steady state: V_RC → I * R
    expect(V).toBeCloseTo(I * R, 3);
  });

  it('satisfies exact exponential solution at t=tau', () => {
    const I = 5;
    const R = 0.02;
    const tau = 5;
    const dt = 0.001;
    let V = 0;
    const steps = Math.round(tau / dt);
    for (let i = 0; i < steps; i++) {
      V = stepRC(V, I, R, tau, dt);
    }
    // After 1 tau: V = I*R*(1 - e^-1) ≈ 0.6321 * I*R
    const expected = I * R * (1 - Math.exp(-1));
    expect(V).toBeCloseTo(expected, 2);
  });

  it('step size dt=0 returns unchanged value', () => {
    const V0 = 0.5;
    expect(stepRC(V0, 10, 0.01, 5, 0)).toBeCloseTo(V0, 6);
  });
});
