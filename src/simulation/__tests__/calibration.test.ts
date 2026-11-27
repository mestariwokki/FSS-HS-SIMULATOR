/**
 * The fitting code must recover known parameters from synthetic test data
 * generated with the model itself (plus sensor noise).
 */
import { describe, it, expect } from 'vitest';
import {
  readCsv, fitOcv, fitHppc, summariseHppc, fitArrhenius, fitStackThermal, type Series,
} from '../../calibration/fitCell';
import {
  type PackModelConfig, defaultPackModel, initPackState, evalPack, stepPack, cellRC, EP9343126VVP_MODEL,
} from '../cellModel';
import { OCV_CELL_V } from '../cellData';

const cell: PackModelConfig = { ...defaultPackModel(1, 1), R_hsc_internal_Ohm: 0, R_cables_Ohm: 0, weak_dQ: 0, weak_dR: 0 };

// deterministic pseudo-noise
let seed = 1;
const noise = (amp: number) => { seed = (seed * 16807) % 2147483647; return amp * (seed / 2147483647 - 0.5) * 2; };

/** Simulate a current profile on one cell at constant temperature. */
function simulate(profile: (t: number) => number, t_end: number, dt: number, T_C: number, soc0 = 1, vNoise = 0.0005): Series {
  let st = initPackState(soc0);
  const s: Series = { t: [], I: [], V: [], T: [], extra: {} };
  for (let t = 0; t <= t_end; t += dt) {
    const I = profile(t);
    s.t.push(t); s.I.push(I); s.V.push(evalPack(st, cell, I, T_C).V_cell_avg + noise(vNoise)); s.T.push(T_C);
    st = stepPack(st, cell, I, T_C, dt);
  }
  return s;
}

describe('CSV reader', () => {
  it('reads semicolon + decimal comma and aliases, flips current sign', () => {
    const s = readCsv('aika;virta;jännite;lämpötila\n0;-1,5;4,10;25\n1;-1,5;4,09;25,1\n', true);
    expect(s.t).toEqual([0, 1]);
    expect(s.I).toEqual([1.5, 1.5]);
    expect(s.V[1]).toBeCloseTo(4.09, 6);
    expect(s.T[1]).toBeCloseTo(25.1, 6);
  });
});

describe('OCV fit', () => {
  it('C/10 discharge + charge average recovers the OCV table within 15 mV', () => {
    const I = 0.66;
    const dis = simulate(() => I, 36000, 10, 25, 1);
    // stop at the cut-off
    const k = dis.V.findIndex(v => v < 2.9);
    const d: Series = { t: dis.t.slice(0, k), I: dis.I.slice(0, k), V: dis.V.slice(0, k), T: dis.T.slice(0, k), extra: {} };
    const chg = simulate(() => -I, 36000, 10, 25, -0.001);
    const kc = chg.V.findIndex(v => v > 4.40);
    const c: Series = { t: chg.t.slice(0, kc), I: chg.I.slice(0, kc), V: chg.V.slice(0, kc), T: chg.T.slice(0, kc), extra: {} };
    const f = fitOcv(d, c);
    expect(f.capacity_Ah).toBeGreaterThan(6.4);
    expect(f.capacity_Ah).toBeLessThan(6.8);
    // compare inside 10–90 % SOC (ends depend on where the test stops)
    for (let i = 2; i < f.soc.length - 1; i++) expect(Math.abs(f.ocv[i] - OCV_CELL_V[i])).toBeLessThan(0.015);
  });
});

describe('HPPC fit', () => {
  // 10 s 5C pulse, 40 s rest, 0.5C discharge to the next 10 % step
  function hppcProfile(T_C: number) {
    const I_p = 33, I_d = 3.3;
    const steps: [number, number][] = [];
    for (let k = 0; k < 9; k++) {
      steps.push([600, 0], [10, I_p], [40, 0]);
      steps.push([0.1 * 6.6 * 3600 / I_d - 10 * I_p / I_d, I_d]);
    }
    const ends: number[] = []; let acc = 0;
    for (const [d] of steps) { acc += d; ends.push(acc); }
    const prof = (t: number) => { const i = ends.findIndex(e => t < e); return i < 0 ? 0 : steps[i][1]; };
    return simulate(prof, acc, 0.1, T_C, 1, 0.0002);
  }

  it('recovers R0, R1+R2 and the time constants at 25 °C', () => {
    const fits = fitHppc(hppcProfile(25), 6.6, 20);
    expect(fits.length).toBe(9);
    const sum = summariseHppc(fits);
    const ref = cellRC(0.5, 25);
    // R0 of a 0.1 s sample includes 0.1 s of the fast RC
    expect(sum.R0_ref_Ohm).toBeGreaterThan(ref.R0 * 0.97);
    expect(sum.R0_ref_Ohm).toBeLessThan((ref.R0 + ref.R1 * (1 - Math.exp(-0.1 / ref.tau1))) * 1.05);
    const tot = sum.R0_ref_Ohm + sum.R1_ref_Ohm + sum.R2_ref_Ohm * (1 - Math.exp(-10 / sum.tau2_s));
    const totRef = ref.R0 + ref.R1 * (1 - Math.exp(-10 / ref.tau1)) + ref.R2 * (1 - Math.exp(-10 / ref.tau2));
    expect(Math.abs(tot - totRef) / totRef).toBeLessThan(0.08);
    for (const f of fits) expect(f.rmse_mV).toBeLessThan(1);
    // the rest after each pulse separates the slow RC from the fast one
    expect(sum.tau2_s).toBeGreaterThanOrEqual(25);
    expect(sum.tau2_s).toBeLessThanOrEqual(60);
    expect(Math.abs(sum.R2_ref_Ohm - ref.R2) / ref.R2).toBeLessThan(0.3);
    expect(sum.tau1_s).toBeLessThanOrEqual(4);
  });

  it('Arrhenius fit returns the model activation energy', () => {
    const pts = [0, 25, 45].map(T => ({ T_C: T, R: cellRC(0.5, T).R0 }));
    const a = fitArrhenius(pts);
    expect(a.Ea).toBeCloseTo(EP9343126VVP_MODEL.Ea_R0, -2);
    expect(a.R25).toBeCloseTo(cellRC(0.5, 25).R0, 6);
  });
});

describe('stack thermal fit', () => {
  it('recovers C and UA from a 20 min heating + 30 min cool-down test', () => {
    const C = 120, UA = 0.08, R = 0.003, P = 2, Ta = 22;
    const t: number[] = [], I: number[] = [], T: number[] = [];
    let th = Ta;
    for (let k = 0; k <= 3000; k++) {
      const tk = k * 1;
      const Ip = tk < 1200 ? 120 : 0;
      t.push(tk); I.push(Ip); T.push(th + noise(0.05));
      const q = (Ip / P) ** 2 * R;
      th += (q - UA * (th - Ta)) / C * 1;
    }
    const f = fitStackThermal(t, I, T, Ta, P, R);
    expect(f.C_JK).toBeGreaterThan(C * 0.93);
    expect(f.C_JK).toBeLessThan(C * 1.07);
    expect(f.UA_WK).toBeGreaterThan(UA * 0.85);
    expect(f.UA_WK).toBeLessThan(UA * 1.15);
  });
});
