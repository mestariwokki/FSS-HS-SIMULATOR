/**
 * EP9343126VVP cell model: 2RC equivalent circuit whose parameters depend on
 * state of charge AND temperature, plus the matching heat-generation terms.
 *
 *   V_cell = OCV(SOC, T) − I·R0(SOC, T) − V1 − V2
 *   dV_k/dt = −V_k/τ_k + I·R_k/τ_k          (k = 1, 2; exact exponential step)
 *   Q_cell  = I²R0 + V1²/R1 + V2²/R2 − I·T·dU/dT(SOC)     (Bernardi, I > 0 discharge)
 *
 * This is the single source of cell physics. simStep (Battery tab),
 * battery2RCStep (Hybrid tab) and the endurance simulator all call it, so the
 * three tabs no longer use three different resistance sets.
 *
 * Provenance of every number (see docs/hsc-model-assumptions.md):
 *   datasheet  — EP210828033 V1.01
 *   literature — typical values for high-rate LiCoO2/graphite pouch cells
 *   estimate   — chosen to be consistent with the datasheet, to be replaced by
 *                a C/10 OCV test + HPPC pulse test at 0 / 25 / 45 °C
 */
import {
  OCV_SOC_PTS, OCV_CELL_V, CELL_CAPACITY_AH, CELL_MASS_KG, CELL_R_AC_TYP_OHM,
} from './cellData';

const R_GAS = 8.31446;
const T_REF_K = 298.15;

// ── Generic helpers ───────────────────────────────────────────────────────

/** Piecewise-linear table lookup, x clamped to the table range. */
export function interp1(x: number, xs: readonly number[], ys: readonly number[]): number {
  if (x <= xs[0]) return ys[0];
  const n = xs.length - 1;
  if (x >= xs[n]) return ys[n];
  for (let i = 0; i < n; i++) {
    if (x <= xs[i + 1]) {
      const t = (x - xs[i]) / (xs[i + 1] - xs[i]);
      return ys[i] + t * (ys[i + 1] - ys[i]);
    }
  }
  return ys[n];
}

/** Arrhenius factor relative to 25 °C: >1 when colder. */
export function arrheniusFactor(Ea_Jmol: number, T_C: number): number {
  const T_K = Math.max(223.15, T_C + 273.15);
  return Math.exp((Ea_Jmol / R_GAS) * (1 / T_K - 1 / T_REF_K));
}

// ── Parameter set ─────────────────────────────────────────────────────────

export interface CellModelParams {
  Q_Ah: number;              // datasheet 6.6 Ah
  mass_kg: number;           // datasheet 0.102 kg
  cp_JkgK: number;           // literature, LCO pouch 1000–1100
  /** R0 at 25 °C, 50 % SOC [Ω] — ohmic part, ≈ 1 kHz AC value */
  R0_ref_Ohm: number;
  R1_ref_Ohm: number;        // charge-transfer RC at 25 °C, 50 % SOC
  tau1_s: number;
  R2_ref_Ohm: number;        // diffusion RC at 25 °C, 50 % SOC
  tau2_s: number;
  Ea_R0: number;             // J/mol, electrolyte conductivity
  Ea_R1: number;             // J/mol, charge transfer
  Ea_R2: number;             // J/mol, solid diffusion
  /** Relative SOC shape of the resistances (multiplies *_ref) */
  r_soc_pts: readonly number[];
  r0_soc_fac: readonly number[];
  r2_soc_fac: readonly number[];
  /** Entropic coefficient dU/dT [V/K] vs SOC */
  dudt_soc_pts: readonly number[];
  dudt_VK: readonly number[];
  /** Usable capacity factor vs temperature (datasheet anchors −20/25/60 °C) */
  q_T_pts: readonly number[];
  q_T_fac: readonly number[];
}

export const EP9343126VVP_MODEL: CellModelParams = {
  Q_Ah: CELL_CAPACITY_AH,
  mass_kg: CELL_MASS_KG,
  cp_JkgK: 1050,
  // datasheet: 2.1 mΩ typ at 1 kHz. Ohmic R0 from a 10 ms pulse is typically
  // 5–15 % above the 1 kHz value for this kind of cell (estimate).
  R0_ref_Ohm: CELL_R_AC_TYP_OHM * 1.1,
  R1_ref_Ohm: 0.00055,
  tau1_s: 2.0,
  R2_ref_Ohm: 0.00075,
  tau2_s: 40,
  // → 10 s DC resistance at 25 °C, 50 % SOC ≈ 3.1 mΩ, 30 s ≈ 3.4 mΩ (estimate,
  //   matches the ~3 mΩ used in the concept document)
  Ea_R0: 18000,   // literature 15–25 kJ/mol → R0 ×1.9 at 0 °C, ×4.4 at −20 °C
  Ea_R1: 45000,   // literature 40–60 kJ/mol
  Ea_R2: 30000,   // literature 25–35 kJ/mol
  r_soc_pts:  [0.00, 0.05, 0.10, 0.20, 0.30, 0.50, 0.80, 0.95, 1.00],
  r0_soc_fac: [1.45, 1.25, 1.12, 1.05, 1.02, 1.00, 1.00, 1.02, 1.04],
  r2_soc_fac: [3.00, 2.20, 1.60, 1.25, 1.10, 1.00, 1.00, 1.10, 1.20],
  // LiCoO2/graphite, shape after Viswanathan et al. 2010 / Thomas & Newman 2003
  dudt_soc_pts: [0.00, 0.10, 0.20, 0.30, 0.40, 0.50, 0.60, 0.70, 0.80, 0.90, 1.00],
  dudt_VK: [-0.40e-3, -0.35e-3, -0.25e-3, -0.15e-3, -0.06e-3, 0.0, 0.05e-3, 0.08e-3, 0.05e-3, -0.02e-3, -0.10e-3],
  // datasheet: −20 °C ≥ 60 %, 25 °C 100 %, 60 °C ≥ 95 % (1C); 0 °C literature
  q_T_pts: [-20, 0, 10, 25, 45, 60],
  q_T_fac: [0.70, 0.90, 0.96, 1.00, 1.00, 0.98],
};

// ── Cell-level functions ──────────────────────────────────────────────────

/** Open-circuit voltage incl. entropic temperature shift [V/cell]. */
export function ocvCellT(soc: number, T_C: number, p: CellModelParams = EP9343126VVP_MODEL): number {
  return ocvExtended(soc) + dUdT(soc, p) * (T_C - 25);
}

/**
 * OCV table extended past its ends so a cell can actually be run empty or
 * overcharged in the model: below 0 % SOC the voltage collapses to the
 * 2.75 V cut-off within 2 % SOC (the 0.2C capacity definition), above 100 %
 * it keeps rising at the top-of-charge slope.
 */
export function ocvExtended(soc: number): number {
  const n = OCV_CELL_V.length - 1;
  if (soc < 0) return OCV_CELL_V[0] + soc * ((OCV_CELL_V[0] - 2.75) / 0.02);
  if (soc > 1) {
    const slope = (OCV_CELL_V[n] - OCV_CELL_V[n - 1]) / (OCV_SOC_PTS[n] - OCV_SOC_PTS[n - 1]);
    return OCV_CELL_V[n] + (soc - 1) * slope;
  }
  return interp1(soc, OCV_SOC_PTS, OCV_CELL_V);
}

/** Entropic coefficient dU/dT [V/K]. */
export function dUdT(soc: number, p: CellModelParams = EP9343126VVP_MODEL): number {
  return interp1(soc, p.dudt_soc_pts, p.dudt_VK);
}

export interface CellRC {
  R0: number; R1: number; tau1: number; R2: number; tau2: number;
}

/** All ECM resistances of one cell at (SOC, T) [Ω]. */
export function cellRC(soc: number, T_C: number, p: CellModelParams = EP9343126VVP_MODEL): CellRC {
  const f0 = interp1(soc, p.r_soc_pts, p.r0_soc_fac);
  const f2 = interp1(soc, p.r_soc_pts, p.r2_soc_fac);
  return {
    R0: p.R0_ref_Ohm * f0 * arrheniusFactor(p.Ea_R0, T_C),
    R1: p.R1_ref_Ohm * f0 * arrheniusFactor(p.Ea_R1, T_C),
    tau1: p.tau1_s,
    R2: p.R2_ref_Ohm * f2 * arrheniusFactor(p.Ea_R2, T_C),
    tau2: p.tau2_s,
  };
}

/** Resistance multipliers relative to 25 °C / 50 % SOC (for user-set pack R). */
export function resistanceFactors(soc: number, T_C: number, p: CellModelParams = EP9343126VVP_MODEL) {
  const r = cellRC(soc, T_C, p);
  return { f0: r.R0 / p.R0_ref_Ohm, f1: r.R1 / p.R1_ref_Ohm, f2: r.R2 / p.R2_ref_Ohm };
}

/** Usable capacity factor at temperature T. */
export function capacityFactorT(T_C: number, p: CellModelParams = EP9343126VVP_MODEL): number {
  return interp1(T_C, p.q_T_pts, p.q_T_fac);
}

/** "DC resistance" seen by a constant-current pulse of length t [Ω/cell]. */
export function pulseResistance(soc: number, T_C: number, t_s: number, p: CellModelParams = EP9343126VVP_MODEL): number {
  const r = cellRC(soc, T_C, p);
  return r.R0 + r.R1 * (1 - Math.exp(-t_s / r.tau1)) + r.R2 * (1 - Math.exp(-t_s / r.tau2));
}

// ── Pack model with weakest cell group ───────────────────────────────────

export interface PackModelConfig {
  series: number;
  parallel: number;
  cell: CellModelParams;
  /** Resistance inside the HSC outside the cells: busbars, AIR, fuse, shunt [Ω] */
  R_hsc_internal_Ohm: number;
  /** Cables HSC → ESCs (affect ESC voltage, not cell voltage or HSC heat) [Ω] */
  R_cables_Ohm: number;
  /** Weakest parallel group: capacity this much lower (e.g. 0.03) */
  weak_dQ: number;
  /** Weakest parallel group: resistance this much higher (e.g. 0.10) */
  weak_dR: number;
  /** Ageing: capacity and resistance multipliers */
  soh_cap: number;
  soh_res: number;
}

export function defaultPackModel(series = 13, parallel = 2): PackModelConfig {
  return {
    series,
    parallel,
    cell: EP9343126VVP_MODEL,
    // 12 tab/busbar joints × 0.05 mΩ + AIR 0.2 + fuse 0.3 + shunt 0.1 (estimate)
    R_hsc_internal_Ohm: 0.0012,
    // 2 × 1 m 25 mm² Cu ≈ 1.4 mΩ (estimate, depends on harness)
    R_cables_Ohm: 0.0014,
    weak_dQ: 0.03,
    weak_dR: 0.10,
    soh_cap: 1,
    soh_res: 1,
  };
}

export interface PackState {
  soc: number;       // average string SOC
  soc_weak: number;  // weakest parallel group SOC
  v1: number;        // per-cell RC voltages (average group)
  v2: number;
  v1w: number;       // weakest group
  v2w: number;
}

export function initPackState(soc0: number): PackState {
  return { soc: soc0, soc_weak: soc0, v1: 0, v2: 0, v1w: 0, v2w: 0 };
}

export interface PackEval {
  ocv_cell: number;
  R0_cell: number;
  /** Pack voltage at the HSC terminals [V] */
  V_hsc: number;
  /** Voltage at the ESC input (after cables) [V] */
  V_esc: number;
  V_cell_avg: number;
  V_cell_min: number;   // weakest group — what the BMS sees on discharge
  V_cell_max: number;   // highest cell — what the BMS sees on charge
  /** Heat generated in the cells [W] (all S·P cells) */
  Q_cells_W: number;
  /** Heat in busbars/AIR/fuse inside the HSC [W] */
  Q_hsc_internal_W: number;
}

/** Pack terminal quantities for current I (>0 discharge) without stepping state. */
export function evalPack(st: PackState, cfg: PackModelConfig, I_pack: number, T_cell_C: number): PackEval {
  const { series: S, parallel: P, cell } = cfg;
  const I = I_pack / P;
  const rc = cellRC(st.soc, T_cell_C, cell);
  const R0 = rc.R0 * cfg.soh_res;
  const ocv = ocvCellT(st.soc, T_cell_C, cell);
  const V_avg = ocv - I * R0 - st.v1 - st.v2;

  const rcw = cellRC(st.soc_weak, T_cell_C, cell);
  const ocvw = ocvCellT(st.soc_weak, T_cell_C, cell);
  const kw = cfg.soh_res * (1 + cfg.weak_dR);
  const V_weak = ocvw - I * rcw.R0 * kw - st.v1w - st.v2w;

  // Weak group drops more on discharge, and rises more on charge
  const V_cell_min = Math.min(V_avg, V_weak);
  const V_cell_max = Math.max(V_avg, V_weak);
  // Pack voltage: (S−1) average groups + 1 weak group
  const V_cells = (S - 1) * V_avg + V_weak;
  const V_hsc = V_cells - I_pack * cfg.R_hsc_internal_Ohm;
  const V_esc = V_hsc - I_pack * cfg.R_cables_Ohm;

  const T_K = T_cell_C + 273.15;
  const R1 = rc.R1 * cfg.soh_res, R2 = rc.R2 * cfg.soh_res;
  const q_cell = I * I * R0 + st.v1 * st.v1 / R1 + st.v2 * st.v2 / R2
    - I * T_K * dUdT(st.soc, cell);
  const Q_cells_W = q_cell * S * P;
  const Q_hsc_internal_W = I_pack * I_pack * cfg.R_hsc_internal_Ohm;

  return {
    ocv_cell: ocv, R0_cell: R0, V_hsc, V_esc,
    V_cell_avg: V_avg, V_cell_min, V_cell_max, Q_cells_W, Q_hsc_internal_W,
  };
}

/** Advance the pack state by dt with constant current I_pack (>0 discharge). */
export function stepPack(st: PackState, cfg: PackModelConfig, I_pack: number, T_cell_C: number, dt: number): PackState {
  const { parallel: P, cell } = cfg;
  const I = I_pack / P;
  const rc = cellRC(st.soc, T_cell_C, cell);
  const rcw = cellRC(st.soc_weak, T_cell_C, cell);
  const kw = cfg.soh_res * (1 + cfg.weak_dR);
  const a1 = Math.exp(-dt / rc.tau1), a2 = Math.exp(-dt / rc.tau2);
  const Qc = cell.Q_Ah * cfg.soh_cap * capacityFactorT(T_cell_C, cell) * 3600;
  const Qw = Qc * (1 - cfg.weak_dQ);
  return {
    soc: st.soc - I * dt / Qc,
    soc_weak: st.soc_weak - I * dt / Qw,
    v1: st.v1 * a1 + I * rc.R1 * cfg.soh_res * (1 - a1),
    v2: st.v2 * a2 + I * rc.R2 * cfg.soh_res * (1 - a2),
    v1w: st.v1w * a1 + I * rcw.R1 * kw * (1 - a1),
    v2w: st.v2w * a2 + I * rcw.R2 * kw * (1 - a2),
  };
}

/**
 * Pack current that delivers electrical power P_W at the ESC input
 * (P > 0 discharge, P < 0 charge). Solves V_esc(I)·I = P with the linear
 * Thevenin form V_esc = E − I·R. Returns the discharge-side root.
 */
export function currentForPower(st: PackState, cfg: PackModelConfig, P_W: number, T_cell_C: number): number {
  const e0 = evalPack(st, cfg, 0, T_cell_C);
  const E = e0.V_esc;
  const e1 = evalPack(st, cfg, 1, T_cell_C);
  const R = Math.max(1e-6, E - e1.V_esc);
  const disc = E * E - 4 * R * P_W;
  if (disc <= 0) return E / (2 * R); // beyond matched power: max-power current
  return (E - Math.sqrt(disc)) / (2 * R);
}

/** Thermal mass of all cells [J/K]. */
export function cellsHeatCapacity(cfg: PackModelConfig): number {
  return cfg.series * cfg.parallel * cfg.cell.mass_kg * cfg.cell.cp_JkgK;
}
