import { describe, it, expect } from 'vitest';
import { stepThermal } from '../thermal';

const T_AMB = 298.15; // 25°C in K
const MCP = 2700;     // J/K pack thermal mass
const HA = 10;        // W/K

describe('stepThermal', () => {
  it('at thermal equilibrium (T=T_amb, I=0) temperature stays constant', () => {
    const T_next = stepThermal(T_AMB, 0, 0, 0.024, T_AMB, MCP, HA, 0.1);
    expect(T_next).toBeCloseTo(T_AMB, 4);
  });

  it('Joule heating raises temperature under load', () => {
    const T0 = T_AMB;
    const T1 = stepThermal(T0, 100, 100 / 26, 0.024, T_AMB, MCP, HA, 1.0);
    expect(T1).toBeGreaterThan(T0);
  });

  it('temperature cannot drop below ambient', () => {
    // Artificially start below ambient (should not happen in practice)
    const T_cold = T_AMB - 10;
    const T_next = stepThermal(T_cold, 0, 0, 0.024, T_AMB, MCP, HA, 0.1);
    expect(T_next).toBeGreaterThanOrEqual(T_AMB);
  });

  it('cooling pulls temperature toward ambient over time', () => {
    let T = T_AMB + 20; // 45°C
    const dt = 1.0;
    for (let i = 0; i < 3600; i++) {
      T = stepThermal(T, 0, 0, 0.024, T_AMB, MCP, HA, dt);
    }
    // After 1 hour with no load, should be close to ambient
    expect(T).toBeCloseTo(T_AMB, 0);
  });

  it('temperature increases faster with higher current', () => {
    const dt = 1.0;
    const T_low  = stepThermal(T_AMB, 50,  50  / 26, 0.024, T_AMB, MCP, HA, dt);
    const T_high = stepThermal(T_AMB, 250, 250 / 26, 0.024, T_AMB, MCP, HA, dt);
    expect(T_high).toBeGreaterThan(T_low);
  });

  it('returns a finite number for extreme inputs', () => {
    const result = stepThermal(T_AMB, 500, 500 / 26, 0.1, T_AMB, MCP, HA, 0.1);
    expect(isFinite(result)).toBe(true);
  });
});
