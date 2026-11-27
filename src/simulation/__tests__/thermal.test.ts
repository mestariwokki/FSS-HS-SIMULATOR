import { describe, it, expect } from 'vitest';
import { stepThermal, reversibleHeat } from '../thermal';

const T_AMB = 298.15; // 25°C in K
const MCP = 2700;     // J/K pack thermal mass
const HA = 10;        // W/K
const S = 13;

describe('stepThermal', () => {
  it('at thermal equilibrium (T=T_amb, I=0) temperature stays constant', () => {
    const T_next = stepThermal(T_AMB, 0, 0, S, T_AMB, MCP, HA, 0.1);
    expect(T_next).toBeCloseTo(T_AMB, 4);
  });

  it('Joule heating raises temperature under load', () => {
    const T1 = stepThermal(T_AMB, 100, 100 ** 2 * 0.024, S, T_AMB, MCP, HA, 1.0);
    expect(T1).toBeGreaterThan(T_AMB);
  });

  it('a pack colder than ambient warms toward ambient', () => {
    const T_cold = T_AMB - 10;
    const T_next = stepThermal(T_cold, 0, 0, S, T_AMB, MCP, HA, 1.0);
    expect(T_next).toBeGreaterThan(T_cold);
    expect(T_next).toBeLessThan(T_AMB);
  });

  it('cools toward the given ambient, not a fixed 25 °C', () => {
    const T_amb_hot = 273.15 + 35;
    let T = T_amb_hot + 20;
    for (let i = 0; i < 3600; i++) T = stepThermal(T, 0, 0, S, T_amb_hot, MCP, HA, 1.0);
    expect(T).toBeCloseTo(T_amb_hot, 0);
  });

  it('temperature increases faster with higher current', () => {
    const T_low  = stepThermal(T_AMB, 50,  50 ** 2 * 0.024,  S, T_AMB, MCP, HA, 1.0);
    const T_high = stepThermal(T_AMB, 198, 198 ** 2 * 0.024, S, T_AMB, MCP, HA, 1.0);
    expect(T_high).toBeGreaterThan(T_low);
  });

  it('steady state = T_amb + P_loss / hA', () => {
    let T = T_AMB;
    for (let i = 0; i < 20000; i++) T = stepThermal(T, 0, 100, S, T_AMB, MCP, HA, 1.0);
    expect(T - T_AMB).toBeCloseTo(100 / HA, 1);
  });
});

describe('reversibleHeat', () => {
  it('is positive on discharge and negative on charge (LiCoO2/graphite)', () => {
    expect(reversibleHeat(100, S, T_AMB)).toBeGreaterThan(0);
    expect(reversibleHeat(-50, S, T_AMB)).toBeLessThan(0);
  });

  it('scales with the number of series cells (whole pack, not one cell)', () => {
    // 100 A, 13S, 298 K, dU/dT = -8e-5 V/K → ≈ 31 W
    expect(reversibleHeat(100, S, T_AMB)).toBeCloseTo(100 * 13 * T_AMB * 8e-5, 3);
  });
});
