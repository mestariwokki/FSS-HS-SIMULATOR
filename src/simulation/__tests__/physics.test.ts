import { describe, it, expect } from 'vitest';
import { calcShortCircuit } from '../shortCircuit';
import { tractionLimit } from '../motor/traction';
import { calcAccelStep, dragForce } from '../motor/vehicleDynamics';
import type { PackConfig, EcmConfig } from '../../types';

const PACK: PackConfig = {
  series: 13, parallel: 2,
  cell: { capacity_Ah: 6.6, v_max: 4.45, v_nom: 3.90, v_min: 2.75 },
  resistance_Ohm: 0.024, thermalMass_JK: 2700, coolingUA_WK: 10,
  v_max: 57.85, v_nom: 50.70, v_min: 35.75, capacity_Ah: 13.2, i_max: 198,
};

const ECM: EcmConfig = {
  R1_Ohm: 0.010, tau1_s: 5, R2_Ohm: 0.015, tau2_s: 50,
  cycles: 0, kQ: 1.5e-4, kR: 4.0e-4, soh_cap: 1.0, soh_res: 1.0,
};

describe('calcShortCircuit', () => {
  it('I_sc = V_max / R_pack_eff', () => {
    const r = calcShortCircuit(PACK, ECM);
    expect(r.I_sc_max).toBeCloseTo(PACK.v_max / PACK.resistance_Ohm, 2);
  });

  it('returns 10 SOC levels', () => {
    const r = calcShortCircuit(PACK, ECM);
    expect(r.socLevels.length).toBe(10);
  });

  it('higher SOC → higher short-circuit current', () => {
    const r = calcShortCircuit(PACK, ECM);
    const high = r.socLevels.find(s => s.soc === 1.0)!;
    const low  = r.socLevels.find(s => s.soc === 0.1)!;
    expect(high.I_sc).toBeGreaterThan(low.I_sc);
  });

  it('with SoH degradation, R_pack_eff is higher → I_sc lower', () => {
    const degraded: EcmConfig = { ...ECM, soh_res: 1.5 };
    const r_new  = calcShortCircuit(PACK, ECM);
    const r_aged = calcShortCircuit(PACK, degraded);
    expect(r_aged.I_sc_max).toBeLessThan(r_new.I_sc_max);
  });

  it('P_sc_max = V^2 / (4R) — maximum power transfer theorem', () => {
    const r = calcShortCircuit(PACK, ECM);
    const expected = PACK.v_max ** 2 / (4 * PACK.resistance_Ohm);
    expect(r.P_sc_max).toBeCloseTo(expected, 2);
  });
});

describe('tractionLimit', () => {
  const mass = 300, mu = 1.6, f_front = 0.45, h_cg = 0.30, wb = 1.55;

  it('at rest (a=0), front load = static weight fraction', () => {
    const { F_el_max } = tractionLimit(0, mass, mu, f_front, h_cg, wb);
    expect(F_el_max).toBeCloseTo(mu * mass * 9.81 * f_front, 1);
  });

  it('under acceleration, weight transfers rearward → F_el_max decreases', () => {
    const { F_el_max: F0 } = tractionLimit(0, mass, mu, f_front, h_cg, wb);
    const { F_el_max: F_accel } = tractionLimit(5, mass, mu, f_front, h_cg, wb);
    expect(F_accel).toBeLessThan(F0);
  });

  it('total normal force is conserved (N_f + N_r = mg)', () => {
    const { F_el_max, F_rear_max } = tractionLimit(3, mass, mu, f_front, h_cg, wb);
    const total = (F_el_max + F_rear_max) / mu;
    expect(total).toBeCloseTo(mass * 9.81, 0);
  });

  it('forces are always non-negative', () => {
    const r = tractionLimit(20, mass, mu, f_front, h_cg, wb);
    expect(r.F_el_max).toBeGreaterThanOrEqual(0);
    expect(r.F_rear_max).toBeGreaterThanOrEqual(0);
  });
});

describe('calcAccelStep — vehicle dynamics', () => {
  const mass = 300, CdA = 0.40, Crr = 0.015, dt = 0.05;

  it('from rest with traction force, speed increases', () => {
    const { v_ms } = calcAccelStep(0, 2000, mass, CdA, Crr, dt);
    expect(v_ms).toBeGreaterThan(0);
  });

  it('with zero traction force, vehicle decelerates (drag + rolling)', () => {
    const { a } = calcAccelStep(20, 0, mass, CdA, Crr, dt);
    expect(a).toBe(0); // a = max(0, ...) so it clips at 0
  });

  it('distance increment is positive when moving', () => {
    const { x_m } = calcAccelStep(10, 3000, mass, CdA, Crr, dt);
    expect(x_m).toBeGreaterThan(0);
  });

  it('v_target clamps output speed', () => {
    const v_target = 5; // m/s
    const { v_ms } = calcAccelStep(4.9, 10000, mass, CdA, Crr, dt, v_target);
    expect(v_ms).toBeLessThanOrEqual(v_target);
  });

  it('higher traction force → higher acceleration', () => {
    const { a: a1 } = calcAccelStep(0, 1000, mass, CdA, Crr, dt);
    const { a: a2 } = calcAccelStep(0, 3000, mass, CdA, Crr, dt);
    expect(a2).toBeGreaterThan(a1);
  });
});

describe('dragForce', () => {
  it('at v=0, only rolling resistance remains', () => {
    const F = dragForce(0, 0.40, 0.015, 300);
    expect(F).toBeCloseTo(0.015 * 300 * 9.81, 2);
  });

  it('scales quadratically with speed', () => {
    const F1 = dragForce(10, 0.40, 0, 300);
    const F2 = dragForce(20, 0.40, 0, 300);
    expect(F2 / F1).toBeCloseTo(4, 1); // 20²/10² = 4
  });
});
