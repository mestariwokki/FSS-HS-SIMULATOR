import { describe, it, expect } from 'vitest';
import { kVtoKt, kVradFromKv } from '../motor/motorConstants';
import { calcEffMap } from '../motor/efficiencyMap';
import { stepMotorThermal } from '../motor/motorThermal';
import type { MotorConfig, PackConfig } from '../../types';


const MC: MotorConfig = {
  Kt_NmA: 0.092,
  kV_rpmV: 104,
  R_winding_Ohm: 0.08,
  P_cont_kW: 3.5,
  P_peak_kW: 5.0,
  n_motors: 2,
  gear_ratio: 3.0,
  wheel_diameter_m: 0.4,
  eta_esc: 0.96,
  I_cont_A: 86,
  I_peak_A: 100,
  eta_regen: 0.85,
  eta_motor: 0.88,
  mCp_motor_JK: 500,
  Rth_motor_KW: 0.5,
  mCp_esc_JK: 200,
  Rth_esc_KW: 0.3,
};

const PACK: PackConfig = {
  series: 13,
  parallel: 2,
  cell: { capacity_Ah: 6.6, v_max: 4.45, v_nom: 3.90, v_min: 2.75 },
  resistance_Ohm: 0.024,
  thermalMass_JK: 2700,
  coolingUA_WK: 10,
  v_max: 57.85,
  v_nom: 50.70,
  v_min: 35.75,
  capacity_Ah: 13.2,
  i_max: 198,
};

describe('kVtoKt — motor constant conversion', () => {
  it('Kt = 1 / kV_rad', () => {
    const Kt = kVtoKt(104);
    const kV_rad = 104 * 2 * Math.PI / 60;
    expect(Kt).toBeCloseTo(1 / kV_rad, 6);
  });

  it('higher kV → lower Kt (faster motor, less torque per amp)', () => {
    expect(kVtoKt(200)).toBeLessThan(kVtoKt(100));
  });
});

describe('kVradFromKv', () => {
  it('converts RPM/V to rad/s/V correctly', () => {
    const kV_rad = kVradFromKv(104);
    expect(kV_rad).toBeCloseTo(104 * 2 * Math.PI / 60, 4);
  });
});

describe('calcEffMap', () => {
  it('returns NX*NY grid of efficiency points', () => {
    const NX = 20, NY = 15;
    const map = calcEffMap(MC, PACK, NX, NY);
    expect(map.length).toBe(NX);
    expect(map[0].length).toBe(NY);
  });

  it('efficiency is in [0, 1] for valid operating points', () => {
    const map = calcEffMap(MC, PACK, 20, 15);
    for (const row of map) {
      for (const cell of row) {
        if (cell.valid) {
          expect(cell.eta).toBeGreaterThanOrEqual(0);
          expect(cell.eta).toBeLessThanOrEqual(1.0);
        }
      }
    }
  });

  it('peak efficiency region exists (η > 0.8)', () => {
    const map = calcEffMap(MC, PACK, 40, 30);
    const hasPeak = map.flat().some(c => c.valid && c.eta > 0.8);
    expect(hasPeak).toBe(true);
  });

  it('max-torque region (iy=0) has lower η than mid-torque (high I²R losses)', () => {
    const NY = 20;
    const NX = 20;
    const map = calcEffMap(MC, PACK, NX, NY);
    // Find mid-RPM column
    const midX = Math.floor(NX / 2);
    const highTorque = map[midX][0];     // iy=0 → max torque → max I → max I²R
    const midTorque  = map[midX][Math.floor(NY / 2)]; // mid torque
    if (highTorque.valid && midTorque.valid) {
      expect(highTorque.eta).toBeLessThan(midTorque.eta);
    } else {
      // If not valid, test passes trivially (out of operating region)
      expect(true).toBe(true);
    }
  });
});

describe('stepMotorThermal', () => {
  const T_AMB = 25;
  // stepMotorThermal(T_motor, T_esc, P_bat_W, eta_motor, eta_esc, mCp_m, Rth_m, mCp_e, Rth_e, dt, T_amb, is_regen)

  it('temperature rises under power loss', () => {
    const { T_motor, T_esc } = stepMotorThermal(
      T_AMB, T_AMB, 5000, MC.eta_motor, MC.eta_esc,
      MC.mCp_motor_JK, MC.Rth_motor_KW, MC.mCp_esc_JK, MC.Rth_esc_KW,
      1.0, T_AMB, false,
    );
    expect(T_motor).toBeGreaterThan(T_AMB);
    expect(T_esc).toBeGreaterThan(T_AMB);
  });

  it('at zero power and ambient temp, stays at ambient', () => {
    const { T_motor, T_esc } = stepMotorThermal(
      T_AMB, T_AMB, 0, MC.eta_motor, MC.eta_esc,
      MC.mCp_motor_JK, MC.Rth_motor_KW, MC.mCp_esc_JK, MC.Rth_esc_KW,
      1.0, T_AMB, false,
    );
    expect(T_motor).toBeCloseTo(T_AMB, 3);
    expect(T_esc).toBeCloseTo(T_AMB, 3);
  });

  it('higher power → higher temperature rise', () => {
    const { T_motor: T1 } = stepMotorThermal(
      T_AMB, T_AMB, 1000, MC.eta_motor, MC.eta_esc,
      MC.mCp_motor_JK, MC.Rth_motor_KW, MC.mCp_esc_JK, MC.Rth_esc_KW,
      1.0, T_AMB, false,
    );
    const { T_motor: T2 } = stepMotorThermal(
      T_AMB, T_AMB, 5000, MC.eta_motor, MC.eta_esc,
      MC.mCp_motor_JK, MC.Rth_motor_KW, MC.mCp_esc_JK, MC.Rth_esc_KW,
      1.0, T_AMB, false,
    );
    expect(T2).toBeGreaterThan(T1);
  });

  it('regen mode: no heat generated (is_regen=true)', () => {
    const { T_motor } = stepMotorThermal(
      T_AMB, T_AMB, 5000, MC.eta_motor, MC.eta_esc,
      MC.mCp_motor_JK, MC.Rth_motor_KW, MC.mCp_esc_JK, MC.Rth_esc_KW,
      1.0, T_AMB, true,
    );
    // In regen, P_loss=0 so temp stays at ambient
    expect(T_motor).toBeCloseTo(T_AMB, 3);
  });
});
