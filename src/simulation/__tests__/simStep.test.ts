import { describe, it, expect } from 'vitest';
import { DU_DT_POS, DU_DT_NEG } from '../constants';
import { getNextCurrent, type CurrentParams } from '../currentControl';
import { simStep } from '../simStep';
import { initialConcentrations } from '../ocv';
import type { SimState, PackConfig, EcmConfig } from '../../types';

const PACK: PackConfig = {
  series: 13,
  parallel: 2,
  cell: { capacity_Ah: 6.6, v_max: 4.45, v_nom: 3.90, v_min: 2.75 },
  resistance_Ohm: 0.024,
  thermalMass_JK: 2700,
  coolingUA_WK: 10,
  v_max: 13 * 4.45,
  v_nom: 13 * 3.90,
  v_min: 13 * 2.75,
  capacity_Ah: 13.2,
  i_max: 198,
};

const ECM: EcmConfig = {
  R1_Ohm: 0.010,
  tau1_s: 5,
  R2_Ohm: 0.015,
  tau2_s: 50,
  cycles: 0,
  kQ: 1.5e-4,
  kR: 4.0e-4,
  soh_cap: 1.0,
  soh_res: 1.0,
};

function makeState(soc = 0.95): SimState {
  const { c_avg_pos, c_avg_neg } = initialConcentrations(soc);
  return {
    t: 0,
    soc,
    soc0: soc,
    c_avg_pos,
    c_avg_neg,
    V_RC: 0,
    V_RC2: 0,
    T_K: 298.15,
    ah: 0,
    wh_out: 0,
    wh_in: 0,
  };
}

describe('simStep — integration step', () => {
  it('returns a data point with all required fields', () => {
    const { point } = simStep(makeState(), PACK, ECM, 100, 0.1);
    const keys: (keyof typeof point)[] = ['t', 'v_oc', 'v_t', 'soc', 'ah', 'i_bat', 'T_C', 'eta_pos', 'eta_neg', 'wh_out'];
    for (const k of keys) {
      expect(point[k]).toBeDefined();
      expect(isFinite(point[k])).toBe(true);
    }
  });

  it('terminal voltage < OCV under discharge load', () => {
    const { point } = simStep(makeState(), PACK, ECM, 250, 0.1);
    expect(point.v_t).toBeLessThan(point.v_oc);
  });

  it('terminal voltage > OCV during charging (negative current)', () => {
    const { point } = simStep(makeState(0.5), PACK, ECM, -13, 0.1);
    expect(point.v_t).toBeGreaterThan(point.v_oc);
  });

  it('SOC decreases over time during discharge', () => {
    let state = makeState(0.95);
    const initialSoc = state.soc;
    for (let i = 0; i < 100; i++) {
      const result = simStep(state, PACK, ECM, 250, 0.1);
      state = result.state;
    }
    expect(state.soc).toBeLessThan(initialSoc);
  });

  it('Ah accumulates correctly: 250A × 10s = 0.694 Ah', () => {
    let state = makeState();
    for (let i = 0; i < 100; i++) {
      state = simStep(state, PACK, ECM, 250, 0.1).state;
    }
    // 250 A * 10 s / 3600 = 0.6944 Ah
    expect(state.ah).toBeCloseTo(250 * 10 / 3600, 3);
  });

  it('temperature increases under high current load', () => {
    let state = makeState();
    const T0 = state.T_K;
    for (let i = 0; i < 100; i++) {
      state = simStep(state, PACK, ECM, 250, 0.1).state;
    }
    expect(state.T_K).toBeGreaterThan(T0);
  });

  it('tracks ambient steps independently of cell temperature at rest', () => {
    const params: CurrentParams = {
      mode: 'profile', ambient_C: 35,
      profileSteps: [{ duration_s: 30, current_A: 0, ambient_C: 0 }, { duration_s: 60, current_A: 0 }],
      current_A: 0, duration_s: 0, charge_current_A: 0, cutoff_current_A: 0,
      charge_duration_s: 0, cv_t_start: null,
    };
    let state = makeState();
    let expectedC = state.T_K - 273.15;
    for (const [duration, ambient] of [[30, 0], [60, 35]]) {
      const input = getNextCurrent(state.t, PACK.v_nom, params, PACK);
      const result = simStep(state, PACK, ECM, input.i, duration, input.ambient_C);
      expectedC = ambient + (expectedC - ambient) * Math.exp(-PACK.coolingUA_WK * duration / PACK.thermalMass_JK);
      expect(result.point.ambient_C).toBe(ambient);
      expect(result.point.T_C).toBeCloseTo(expectedC, 10);
      state = result.state;
    }
  });

  it('defaults to 25 °C for legacy simulations', () => {
    const result = simStep(makeState(), PACK, ECM, 0, 10);
    expect(result.point.ambient_C).toBe(25);
    expect(result.point.T_C).toBeCloseTo(25, 10);
  });

  it('uses aged pack resistance for reported ohmic heat', () => {
    const aged = { ...ECM, soh_res: 1.5 };
    const { point } = simStep(makeState(), PACK, aged, 30, 0.1);
    expect(point.Q_j).toBeCloseTo(30 ** 2 * PACK.resistance_Ohm * aged.soh_res);
  });

  it('converts stored RC energy to heat as a disconnected pack relaxes', () => {
    const state = { ...makeState(), V_RC: 1, V_RC2: -0.5 };
    const pack = { ...PACK, coolingUA_WK: 0 };
    const dt = 2;
    const next = simStep(state, pack, ECM, 0, dt).state;
    const scale = pack.series / pack.parallel;
    const loss1 = ECM.tau1_s / (2 * ECM.R1_Ohm * scale) * (state.V_RC ** 2 - next.V_RC ** 2);
    const loss2 = ECM.tau2_s / (2 * ECM.R2_Ohm * scale) * (state.V_RC2 ** 2 - next.V_RC2 ** 2);
    expect((next.T_K - state.T_K) * pack.thermalMass_JK).toBeCloseTo(loss1 + loss2, 8);
  });

  it('scales reversible heat to all series cells with discharge-positive current', () => {
    const state = makeState();
    const pack = { ...PACK, resistance_Ohm: 0, coolingUA_WK: 0 };
    const ecm = { ...ECM, R1_Ohm: 0, R2_Ohm: 0 };
    for (const current of [30, -30]) {
      const next = simStep(state, pack, ecm, current, 1).state;
      const heat = -pack.series * current * state.T_K * (DU_DT_POS - DU_DT_NEG);
      expect((next.T_K - state.T_K) * pack.thermalMass_JK).toBeCloseTo(heat, 8);
    }
  });

  it('RC element voltages build up from zero', () => {
    let state = makeState();
    expect(state.V_RC).toBe(0);
    for (let i = 0; i < 50; i++) {
      state = simStep(state, PACK, ECM, 100, 0.1).state;
    }
    expect(state.V_RC).toBeGreaterThan(0);
    expect(state.V_RC2).toBeGreaterThan(0);
  });

  it('at I=0 (rest), terminal voltage equals OCV', () => {
    // Start from fully relaxed state
    let state = makeState(0.8);
    state = { ...state, V_RC: 0, V_RC2: 0 };
    const { point } = simStep(state, PACK, ECM, 0, 0.1);
    expect(point.v_t).toBeCloseTo(point.v_oc, 2);
  });

  it('overpotentials are finite during discharge', () => {
    const { point } = simStep(makeState(), PACK, ECM, 100, 0.1);
    expect(isFinite(point.eta_pos)).toBe(true);
    expect(isFinite(point.eta_neg)).toBe(true);
    // Total voltage loss = eta_pos + eta_neg contributes to V_sag
    expect(point.v_oc - point.v_t).toBeGreaterThan(0);
  });
});
