import { describe, it, expect } from 'vitest';
import { motorStep, type MotorStepConfig } from '../motor/motorStep';
import { DEFAULT_MOTOR } from '../motor/motorConstants';
import type { PackConfig, EcmConfig, MotorSimState } from '../../types';

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
  R1_Ohm: 0.001, tau1_s: 5, R2_Ohm: 0.001, tau2_s: 50,
  cycles: 0, kQ: 0, kR: 0, soh_cap: 1, soh_res: 1,
};

const MC: MotorStepConfig = {
  Kt: DEFAULT_MOTOR.Kt, kV: DEFAULT_MOTOR.kV, Rw: DEFAULT_MOTOR.Rw,
  eta_c: DEFAULT_MOTOR.eta_c, eta_regen: DEFAULT_MOTOR.eta_regen,
  gear: DEFAULT_MOTOR.gear, wheel_d_mm: DEFAULT_MOTOR.wheel_d_mm,
  P_cont: DEFAULT_MOTOR.P_cont, P_peak: DEFAULT_MOTOR.P_peak,
  I_cont: DEFAULT_MOTOR.I_cont, I_peak: DEFAULT_MOTOR.I_peak, n: DEFAULT_MOTOR.n,
  eta_m: DEFAULT_MOTOR.eta_m, mCp_m: DEFAULT_MOTOR.mCp_m, R_th_m: DEFAULT_MOTOR.R_th_m,
  mCp_e: DEFAULT_MOTOR.mCp_e, R_th_e: DEFAULT_MOTOR.R_th_e, T_amb: 25,
};

function state(soc: number, T_bat_C = 25): MotorSimState {
  return {
    t: 0, soc, ah: 0, wh_out: 0, wh_regen: 0, V_RC: 0, V_RC2: 0,
    T_motor_C: 25, T_esc_C: 25, T_bat_C, v_kmh: 60, x_m: 0, boost_t: 0,
    trac_ratio: 1, acc75_done: false, t_75: null, v_75: null, a_prev: 0,
    trac_switch_t: null, trac_switch_v: null,
  };
}

describe('motorStep — regen limits (EP9343126VVP)', () => {
  it('limits regen charge current to 2P × 26.4 A', () => {
    const { point } = motorStep(-8, 60, state(0.5), PACK, ECM, MC, 0.1);
    expect(-point.I_bat).toBeLessThanOrEqual(52.8 + 1e-9);
    expect(point.regen_limited).toBe(true);
  });

  it('small regen is not limited', () => {
    const { point } = motorStep(-1, 60, state(0.5), PACK, ECM, MC, 0.1);
    expect(point.regen_limited).toBe(false);
    expect(point.I_bat).toBeLessThan(0);
  });

  it('never pushes the pack above 4.45 V/cell (and so below 60 V)', () => {
    const { point } = motorStep(-5, 60, state(1.0), PACK, ECM, MC, 0.1);
    expect(point.V_t).toBeLessThanOrEqual(PACK.v_max + 1e-9);
    expect(point.V_t).toBeLessThan(60);
  });

  it('no regen when the battery is above 45 °C or below 0 °C', () => {
    expect(motorStep(-3, 60, state(0.5, 50), PACK, ECM, MC, 0.1).point.I_bat).toBeCloseTo(0, 9);
    expect(motorStep(-3, 60, state(0.5, -5), PACK, ECM, MC, 0.1).point.I_bat).toBeCloseTo(0, 9);
  });
});

describe('motorStep — discharge', () => {
  it('does not silently clamp battery current at 249 A', () => {
    // Very low pack voltage + huge demand: the result must show the real current
    const hugeMC = { ...MC, I_peak: 1000, I_cont: 1000 };
    const { point } = motorStep(20, 100, state(0.3), PACK, ECM, hugeMC, 0.1);
    expect(point.I_bat).toBeGreaterThan(249);
  });

  it('battery heats up under load', () => {
    const { state: s } = motorStep(8, 60, state(0.8), PACK, ECM, MC, 1);
    expect(s.T_bat_C).toBeGreaterThan(25);
  });
});
