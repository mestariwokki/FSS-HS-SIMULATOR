/**
 * Lumped 3-node thermal model of the HSC, one parameter set per design concept
 * (concepts A / B / C of hybrid/akkupaketti-3-konseptia.md).
 *
 *   node "hot"   — the worst-cooled cells (stack centre, upper layer, …)
 *   node "cells" — the remaining cells
 *   node "struct"— end plates / base plate / fins / housing
 *
 *   C_hot·dT_hot/dt   = f_hot·Q_cells − UA_hs(T_hot−T_s) − UA_hc(T_hot−T_c)
 *   C_c·dT_c/dt       = (1−f_hot)·Q_cells − UA_cs(T_c−T_s) + UA_hc(T_hot−T_c)
 *   C_s·dT_s/dt       = Q_busbar + UA_hs(T_hot−T_s) + UA_cs(T_c−T_s) − UA_amb(v)(T_s−T_amb)
 *
 * UA_amb depends on vehicle speed (ram air / underbody flow) and, for the
 * forced-air concept, on the fan. The hottest point is the hot-node
 * temperature plus the in-cell through-thickness rise.
 *
 * All UA / C values are engineering estimates from geometry (see
 * docs/hsc-model-assumptions.md). Replace with a measured heating/cool-down
 * curve of the built stack (one 20 min constant-current test gives both C and UA).
 */

export type ConceptId = 'A' | 'B' | 'C' | 'V2' | 'custom';

export interface HscThermalParams {
  id: ConceptId;
  name: string;
  /** Fraction of cells in the hot node */
  f_hot: number;
  /** Extra heat capacity in the structure node [J/K] */
  C_struct_JK: number;
  UA_hot_struct_WK: number;
  UA_cells_struct_WK: number;
  UA_hot_cells_WK: number;
  /** Structure → ambient at standstill [W/K] */
  UA_amb0_WK: number;
  /** Speed-dependent part: UA_amb = UA_amb0 + k_v · v^0.8 [W/K per (m/s)^0.8] */
  UA_amb_kv: number;
  /** Fan contribution (constant while the HSC is live) [W/K] */
  UA_fan_WK: number;
  /** Through-thickness thermal resistance of one cell, centre → surface [K/W] */
  R_int_cell_KW: number;
  note: string;
}

// Cell geometry 125.5 × 43 × 9.3 mm, large face 5.4e-3 m²; through-plane
// conductivity of a pouch cell ≈ 0.8 W/mK; R_int = (t/2)/(k·2A) ≈ 0.54 K/W.
const R_INT = 0.54;

export const HSC_CONCEPTS: Record<Exclude<ConceptId, 'custom'>, HscThermalParams> = {
  A: {
    id: 'A',
    name: 'A – two compressed stacks, passive',
    // 2 stacks × 13 cells; the 5 centre cells of each stack are ~2–3 cells
    // away from an end plate: through-stack conduction to the plates is slow
    // (diffusion time L²/α ≈ 2.5 h), so they run almost adiabatic.
    f_hot: 10 / 26,
    C_struct_JK: 1300,       // 4 end plates + straps + FR box ≈ 1.5 kg Al-equiv.
    UA_hot_struct_WK: 0.15,  // edges/tabs to box air
    UA_cells_struct_WK: 0.9, // outer cells: end plates + edges
    UA_hot_cells_WK: 0.6,    // 4 stack interfaces, k·A/L with L ≈ 3 cells
    UA_amb0_WK: 1.0,         // closed box ~0.25 m², natural convection inside/outside
    UA_amb_kv: 0.12,         // some airflow in the sidepod
    UA_fan_WK: 0,
    R_int_cell_KW: R_INT,
    note: 'No forced cooling. Centre cells of each stack are the hottest.',
  },
  B: {
    id: 'B',
    name: 'B – flat slab, base-plate cooling',
    // 13 columns × 2 layers lying flat. Lower layer on gap pad + 3 mm Al base
    // plate; upper layer cools only through the lower cell.
    f_hot: 13 / 26,
    C_struct_JK: 1100,       // 3 mm Al base plate ≈ 1.1 kg + lid
    UA_hot_struct_WK: 0.3,   // upper cells via lid / edges
    UA_cells_struct_WK: 25,  // lower cells: 13 × (gap pad 3 W/mK, 1 mm, contact)
    UA_hot_cells_WK: 4.0,    // 13 × through-plane k·A/t incl. insulating film
    UA_amb0_WK: 0.8,         // base plate 0.135 m², natural convection
    UA_amb_kv: 0.35,         // underbody flow, ~30 % exposure
    UA_fan_WK: 0,
    R_int_cell_KW: R_INT,
    note: 'Upper layer is the hot node; base plate needs airflow or chassis contact.',
  },
  C: {
    id: 'C',
    name: 'C – single stack, Al fins + fan',
    // Al fin between every cell pair, 12 V fan, duct below the fins.
    f_hot: 6 / 26,           // downstream end of the duct
    C_struct_JK: 900,        // fins ≈ 0.55 kg + housing
    UA_hot_struct_WK: 6,     // fin contact
    UA_cells_struct_WK: 30,
    UA_hot_cells_WK: 1.0,
    UA_amb0_WK: 1.0,
    UA_amb_kv: 0.1,
    UA_fan_WK: 5.5,          // fin area ≈0.2 m², h≈40, ε-NTU limited by fan flow
    R_int_cell_KW: R_INT,
    note: 'Fan must run whenever the HSC is live; fan failure ≈ concept A.',
  },
  V2: {
    id: 'V2',
    name: 'HSC v2 rev0.2 – two stacks, 0.8 mm Al fins + 60 mm fan',
    // hybrid/hsc-v2/HSC-v2-suunnittelu.md: 2 stacks (7 + 6 pairs), one 0.8 mm
    // Al 1050 fin per pair (kapton, both cells of the pair touch it), fins run
    // 25 mm down into a plenum, 60 mm 12 V fan across the plenum.
    // Bottleneck is fin conduction from the cell face down to the plenum:
    // k·A/L = 220 · (43 mm × 0.8 mm) / ~60 mm ≈ 0.13 W/K per fin, 13 fins ≈ 1.6 W/K.
    // Plenum: 13 fins × 2 × 25 × 43 mm ≈ 0.028 m², h ≈ 40 → ≈ 1.1 W/K.
    // In series ≈ 0.65 W/K, i.e. ~20–25 W at 30 K — the design doc's own
    // estimate is 25–30 W. Mid-stack cells (no end-plate leakage) are the hot node.
    f_hot: 14 / 26,
    C_struct_JK: 800,        // fins 176 g Al, Al busbars 224 g, CFRP end/base plates ~600 g, G10 ~320 g; printed hood poorly coupled
    UA_hot_struct_WK: 0.85,  // 14 cells' share of the fin conduction
    UA_cells_struct_WK: 1.1, // 12 cells: fins + end plates
    UA_hot_cells_WK: 0.4,    // through 1 mm foam / PET between pairs
    UA_amb0_WK: 0.5,         // printed FR hood, natural convection
    UA_amb_kv: 0.08,         // little ram air reaches the plenum
    UA_fan_WK: 1.1,          // plenum convection with the fan on
    R_int_cell_KW: R_INT,
    note: 'Current HSC design (5.8 kg). Fin conduction limits cooling to ~25 W; fan must run while the HSC is live.',
  },
};

export interface HscThermalState {
  T_hot_C: number;
  T_cells_C: number;
  T_struct_C: number;
  /** Core-above-surface rise of the hottest cell [K], first-order lag */
  dT_core_K: number;
}

/** Through-thickness diffusion time of one cell, (t/2)²/α ≈ 60 s */
export const TAU_CORE_S = 60;

export function initThermal(T0_C: number): HscThermalState {
  return { T_hot_C: T0_C, T_cells_C: T0_C, T_struct_C: T0_C, dT_core_K: 0 };
}

export function ambientUA(p: HscThermalParams, v_ms: number, fan_on: boolean): number {
  return p.UA_amb0_WK + p.UA_amb_kv * Math.pow(Math.max(0, v_ms), 0.8) + (fan_on ? p.UA_fan_WK : 0);
}

/**
 * Advance the thermal network by dt (explicit, sub-stepped for stability).
 * @param C_cells_JK  heat capacity of ALL cells
 */
export function stepHscThermal(
  st: HscThermalState,
  p: HscThermalParams,
  C_cells_JK: number,
  Q_cells_W: number,
  Q_struct_W: number,
  T_amb_C: number,
  v_ms: number,
  fan_on: boolean,
  dt: number,
  n_cells_total = 26,
): HscThermalState {
  const C_hot = C_cells_JK * p.f_hot;
  const C_c = C_cells_JK * (1 - p.f_hot);
  const UAa = ambientUA(p, v_ms, fan_on);
  // stability: dt_sub < min(C/ΣUA)/2
  const tmin = Math.min(
    C_hot / (p.UA_hot_struct_WK + p.UA_hot_cells_WK),
    C_c / (p.UA_cells_struct_WK + p.UA_hot_cells_WK),
    p.C_struct_JK / (p.UA_hot_struct_WK + p.UA_cells_struct_WK + UAa),
  );
  const n = Math.max(1, Math.ceil(dt / (0.4 * tmin)));
  const h = dt / n;
  let { T_hot_C: Th, T_cells_C: Tc, T_struct_C: Ts } = st;
  for (let i = 0; i < n; i++) {
    const q_hs = p.UA_hot_struct_WK * (Th - Ts);
    const q_cs = p.UA_cells_struct_WK * (Tc - Ts);
    const q_hc = p.UA_hot_cells_WK * (Th - Tc);
    const q_a = UAa * (Ts - T_amb_C);
    Th += (p.f_hot * Q_cells_W - q_hs - q_hc) / C_hot * h;
    Tc += ((1 - p.f_hot) * Q_cells_W - q_cs + q_hc) / C_c * h;
    Ts += (Q_struct_W + q_hs + q_cs - q_a) / p.C_struct_JK * h;
  }
  // Hottest-cell core rise: steady value q_cell·R_int reached with τ ≈ 60 s
  const q_cell = Math.max(0, Q_cells_W / n_cells_total);
  const a = Math.exp(-dt / TAU_CORE_S);
  const dT_core_K = st.dT_core_K * a + q_cell * p.R_int_cell_KW * (1 - a);
  return { T_hot_C: Th, T_cells_C: Tc, T_struct_C: Ts, dT_core_K };
}

/**
 * Hottest cell, core [°C]. The BMS sensor (EV5.8.5: on a conductive surface,
 * i.e. tab/busbar) reads approximately the surface value `st.T_hot_C`.
 */
export function hottestCellC(st: HscThermalState): number {
  return st.T_hot_C + st.dT_core_K;
}

/** Mean cell temperature [°C]. */
export function meanCellC(st: HscThermalState, p: HscThermalParams): number {
  return p.f_hot * st.T_hot_C + (1 - p.f_hot) * st.T_cells_C;
}
