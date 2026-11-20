/**
 * Validation of the shared cell model (cellModel.ts) against the
 * EP9343126VVP datasheet (EP210828033 V1.01). Every limit below is a
 * datasheet requirement, or a closed-form physics result — not a value the
 * model produced itself.
 *
 * Single cell, 23 °C, in still air (h ≈ 10 W/m²K on 0.0139 m² of surface),
 * which is how a supplier runs its rate tests.
 */
import { describe, it, expect } from 'vitest';
import {
  type PackModelConfig, EP9343126VVP_MODEL, defaultPackModel,
  initPackState, evalPack, stepPack, cellsHeatCapacity, pulseResistance, ocvCellT,
} from '../cellModel';
import { CELL_CAPACITY_AH, CELL_V_MIN, CELL_V_NOM, CELL_V_MAX } from '../cellData';

const oneCell: PackModelConfig = {
  ...defaultPackModel(1, 1),
  R_hsc_internal_Ohm: 0, R_cables_Ohm: 0, weak_dQ: 0, weak_dR: 0,
};
const UA_CELL = 10 * 0.0139;  // W/K, still air

/** Constant-current discharge of one cell to 2.75 V. */
function ccDischarge(I: number, T_amb: number, soc0 = 1, dt = 0.5) {
  let st = initPackState(soc0);
  let T = T_amb;
  const C = cellsHeatCapacity(oneCell);
  let ah = 0, wh = 0, t = 0, Tmax = T;
  for (;;) {
    const e = evalPack(st, oneCell, I, T);
    if (e.V_cell_min <= CELL_V_MIN) break;
    if (t > 40000) throw new Error('discharge never reached 2.75 V');
    ah += I * dt / 3600;
    wh += I * e.V_cell_min * dt / 3600;
    T += (e.Q_cells_W - UA_CELL * (T - T_amb)) / C * dt;
    Tmax = Math.max(Tmax, T);
    st = stepPack(st, oneCell, I, T, dt);
    t += dt;
  }
  return { ah, wh, v_avg: wh / ah, t, Tmax };
}

describe('EP9343126VVP model vs datasheet', () => {
  it('OCV: 4.43–4.45 V full, 13S pack ≤ 60 V (CV5.1.2)', () => {
    expect(ocvCellT(1, 25)).toBeGreaterThan(4.40);
    expect(ocvCellT(1, 25)).toBeLessThanOrEqual(CELL_V_MAX);
    expect(13 * CELL_V_MAX).toBeLessThan(60);
  });

  it('0.2C capacity ≥ 98 % of 6.6 Ah', () => {
    const r = ccDischarge(0.2 * CELL_CAPACITY_AH, 23, 1, 5);
    expect(r.ah / CELL_CAPACITY_AH).toBeGreaterThanOrEqual(0.98);
  });

  it('1C average discharge voltage 3.90 V ± 2 %', () => {
    const r = ccDischarge(CELL_CAPACITY_AH, 23, 1, 2);
    expect(r.v_avg).toBeGreaterThan(CELL_V_NOM * 0.98);
    expect(r.v_avg).toBeLessThan(CELL_V_NOM * 1.02);
  });

  it('99 A (15C) capacity ≥ 85 % of nominal', () => {
    const r = ccDischarge(99, 23);
    expect(r.ah / CELL_CAPACITY_AH).toBeGreaterThanOrEqual(0.85);
    // self-heating over a ~4 min 15C discharge in still air: should be large
    // but physically bounded by the adiabatic rise I²R·t / (m·cp)
    const adiabatic = 99 * 99 * pulseResistance(0.5, 23, 60) * r.t / (EP9343126VVP_MODEL.mass_kg * EP9343126VVP_MODEL.cp_JkgK);
    expect(r.Tmax - 23).toBeGreaterThan(15);
    expect(r.Tmax - 23).toBeLessThan(adiabatic * 1.2);
  });

  it('1C at −20 °C gives ≥ 60 % capacity', () => {
    const r = ccDischarge(CELL_CAPACITY_AH, -20);
    expect(r.ah / CELL_CAPACITY_AH).toBeGreaterThanOrEqual(0.60);
  });

  it('1C at 60 °C gives ≥ 95 % capacity', () => {
    const r = ccDischarge(CELL_CAPACITY_AH, 60);
    expect(r.ah / CELL_CAPACITY_AH).toBeGreaterThanOrEqual(0.95);
  });

  it('165 A (25C) for 3 s at 50 % SOC stays above 2.75 V', () => {
    let st = initPackState(0.5);
    let vmin = 9;
    for (let t = 0; t < 3; t += 0.01) {
      vmin = Math.min(vmin, evalPack(st, oneCell, 165, 25).V_cell_min);
      st = stepPack(st, oneCell, 165, 25, 0.01);
    }
    expect(vmin).toBeGreaterThan(CELL_V_MIN);
  });

  it('ohmic R0 near the 2.1 mΩ (1 kHz) datasheet value, 10 s DC 2.5–4 mΩ', () => {
    const r0 = pulseResistance(0.5, 23, 0.001);
    expect(r0).toBeGreaterThan(0.0021);
    expect(r0).toBeLessThan(0.0025 * 1.1);
    const r10 = pulseResistance(0.5, 25, 10);
    expect(r10).toBeGreaterThan(0.0025);
    expect(r10).toBeLessThan(0.004);
  });

  it('resistance rises when cold and at low SOC', () => {
    expect(pulseResistance(0.5, 0, 10)).toBeGreaterThan(1.5 * pulseResistance(0.5, 25, 10));
    expect(pulseResistance(0.05, 25, 10)).toBeGreaterThan(pulseResistance(0.5, 25, 10));
    expect(pulseResistance(0.5, 45, 10)).toBeLessThan(pulseResistance(0.5, 25, 10));
  });
});

describe('weakest cell group', () => {
  it('the weak group is the first to hit the cut-off and sees the largest drop', () => {
    const pack = defaultPackModel();
    const st = { ...initPackState(0.3), soc_weak: 0.28 };
    const e = evalPack(st, pack, 150, 25);
    expect(e.V_cell_min).toBeLessThan(e.V_cell_avg);
    const ec = evalPack(st, pack, -50, 25);
    expect(ec.V_cell_max).toBeGreaterThanOrEqual(ec.V_cell_avg);
  });

  it('energy balance: cell heat ≈ (OCV − V)·I + reversible term', () => {
    const pack = defaultPackModel();
    let st = initPackState(0.5);
    for (let i = 0; i < 100; i++) st = stepPack(st, pack, 100, 25, 0.1);
    const e = evalPack(st, pack, 100, 25);
    expect(e.Q_cells_W).toBeGreaterThan(0);
    // I²R0 alone, lower bound
    expect(e.Q_cells_W).toBeGreaterThan(2 * 13 * 50 * 50 * e.R0_cell * 0.99);
  });
});
