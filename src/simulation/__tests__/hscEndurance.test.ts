import { describe, it, expect } from 'vitest';
import {
  runHscEndurance, runAcceleration, lapProfile,
  defaultVehicle, defaultStrategy, defaultSetup, iceWheelForce, emWheelForce,
} from '../endurance/hscEndurance';
import { FSG_LIKE_LAP, lapLength } from '../endurance/track';
import { defaultPackModel } from '../cellModel';
import { HSC_CONCEPTS, stepHscThermal, initThermal } from '../hscThermal';

const veh = defaultVehicle();
const strat = defaultStrategy();
const pack = defaultPackModel();

describe('track and lap profile', () => {
  it('lap is ~1 km, 21 laps ≈ 22 km (FSG endurance)', () => {
    const L = lapLength(FSG_LIKE_LAP);
    expect(L).toBeGreaterThan(950);
    expect(L).toBeLessThan(1200);
    expect(L * 21).toBeGreaterThan(21000);
    expect(L * 21).toBeLessThan(24000);
  });

  it('average speed 50–65 km/h, top speed < 120 km/h', () => {
    const p = lapProfile(veh, strat, FSG_LIKE_LAP, 1, 0, 52, 15);
    const t = p.reduce((s, x) => s + x.dt, 0);
    const avg = lapLength(FSG_LIKE_LAP) / t * 3.6;
    expect(avg).toBeGreaterThan(50);
    expect(avg).toBeLessThan(65);
    expect(Math.max(...p.map(x => x.v)) * 3.6).toBeLessThan(120);
  });

  it('EM boost makes the lap faster', () => {
    const t0 = lapProfile(veh, strat, FSG_LIKE_LAP, 1, 0, 52, 15).reduce((s, x) => s + x.dt, 0);
    const t1 = lapProfile(veh, strat, FSG_LIKE_LAP, 1, 1, 52, 15).reduce((s, x) => s + x.dt, 0);
    expect(t1).toBeLessThan(t0);
  });

  it('ICE force falls with speed, EM force fades to zero at no-load speed', () => {
    expect(iceWheelForce(veh, 10)).toBeGreaterThan(iceWheelForce(veh, 30));
    const v_nl = 104 * 50 / veh.em_gear * 2 * Math.PI / 60 * veh.wheel_r_m;
    expect(emWheelForce(veh, v_nl * 1.01, 50)).toBe(0);
    expect(emWheelForce(veh, 5, 50)).toBeGreaterThan(0);
  });
});

describe('endurance with the HSC', () => {
  const rA = runHscEndurance(veh, { ...strat, deploy: 'manual', k_manual: 0.8 }, pack, defaultSetup(HSC_CONCEPTS.A));
  const rB = runHscEndurance(veh, { ...strat, deploy: 'manual', k_manual: 0.8 }, pack, defaultSetup(HSC_CONCEPTS.B));
  const rC = runHscEndurance(veh, { ...strat, deploy: 'manual', k_manual: 0.8 }, pack, defaultSetup(HSC_CONCEPTS.C));

  it('stays inside the electrical limits', () => {
    for (const r of [rA, rB, rC]) {
      expect(r.V_hsc_max).toBeLessThan(60);                // CV5.1.2 / T11.1.2
      expect(r.V_cell_max).toBeLessThanOrEqual(4.45);
      expect(r.I_peak_A).toBeLessThanOrEqual(strat.I_dis_limit_A + 1e-6);
      expect(r.I_regen_peak_A).toBeLessThanOrEqual(strat.I_chg_limit_A + 1e-6);
    }
  });

  it('energy and charge balance close', () => {
    const E_drop = (0.95 - rA.soc_end) * 13.2 * 3.9 * 13;   // ≈ Wh from SOC change
    expect(rA.Wh_out - rA.Wh_regen).toBeGreaterThan(E_drop * 0.85);
    expect(rA.Wh_out - rA.Wh_regen).toBeLessThan(E_drop * 1.15);
  });

  it('same drive: passive A runs hotter than B, B hotter than forced-air C', () => {
    expect(rA.T_hot_max_C).toBeGreaterThan(rB.T_hot_max_C);
    expect(rB.T_hot_max_C).toBeGreaterThan(rC.T_hot_max_C);
  });

  it('RMS current is in a physically sensible band', () => {
    expect(rA.I_rms_drive_A).toBeGreaterThan(20);
    expect(rA.I_rms_drive_A).toBeLessThan(120);
  });

  it('auto deployment hits the SOC target without a BMS trip', () => {
    const r = runHscEndurance(veh, strat, pack, defaultSetup(HSC_CONCEPTS.C));
    expect(r.bms_trip).toBeNull();
    expect(r.soc_end).toBeGreaterThanOrEqual(strat.soc_target_end - 1e-6);
    expect(r.soc_end).toBeLessThan(strat.soc_target_end + 0.05);
  });

  it('no regen above 43 °C so the 45 °C charge limit is never violated', () => {
    const hot = runHscEndurance(veh, { ...strat, deploy: 'manual', k_manual: 1 }, pack,
      { ...defaultSetup(HSC_CONCEPTS.A), T_amb_C: 35, T0_C: 40 });
    if (hot.bms_trip) expect(hot.bms_trip).not.toMatch(/\(charge\)/);
  });
});

describe('acceleration 75 m', () => {
  it('hybrid is faster than ICE only and within cell limits', () => {
    const a = runAcceleration(veh, strat, pack, 0.95, 25, HSC_CONCEPTS.A);
    expect(a.t75_s).toBeLessThan(a.t75_ice_only_s);
    expect(a.t75_s).toBeGreaterThan(3.3);
    expect(a.t75_s).toBeLessThan(4.6);
    expect(a.I_peak_A).toBeLessThanOrEqual(198 + 1e-6);
    expect(a.V_cell_min).toBeGreaterThan(2.75);
    expect(a.bms_trip).toBeNull();
  });
});

describe('thermal network', () => {
  it('closed-form steady state of the structure node', () => {
    // With no cell heat and only structure heat Q, T_struct → T_amb + Q/UA
    let st = initThermal(25);
    const p = HSC_CONCEPTS.A;
    for (let i = 0; i < 20000; i++) st = stepHscThermal(st, p, 2785, 0, 10, 25, 0, false, 5);
    expect(st.T_struct_C).toBeCloseTo(25 + 10 / p.UA_amb0_WK, 1);
  });

  it('adiabatic limit: no conductance → ΔT = Q·t / C', () => {
    const p = { ...HSC_CONCEPTS.A, UA_hot_struct_WK: 0, UA_cells_struct_WK: 0, UA_hot_cells_WK: 0 };
    let st = initThermal(25);
    for (let i = 0; i < 600; i++) st = stepHscThermal(st, p, 2785, 50, 0, 25, 0, false, 1);
    expect(st.T_hot_C - 25).toBeCloseTo(50 * 600 / 2785, 2);
    expect(st.T_cells_C - 25).toBeCloseTo(50 * 600 / 2785, 2);
  });
});
