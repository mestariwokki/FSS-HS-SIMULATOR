/**
 * 2RC Thevenin equivalent circuit model for NMC lithium-ion cells.
 *
 * V_terminal = V_oc(SOC) - I·R0(SOC,T) - V_rc1 - V_rc2
 *
 * RC element update (exact discrete):
 *   V_rc(t+dt) = V_rc(t)·exp(-dt/τ) + I·R·(1 - exp(-dt/τ))
 */
import { stepRC } from './ecm';
import { ocvPack } from './ocv';

// ── NMC cell resistance lookup tables ─────────────────────────────────────
// SOC breakpoints (ascending)
const SOC_PTS = [0.20, 0.30, 0.40, 0.50, 0.60, 0.70, 0.80, 0.90, 1.00];

// R0: ohmic resistance [Ω/cell] at 25 °C — increases as SOC drops
const R0_TABLE = [0.035, 0.030, 0.025, 0.022, 0.020, 0.018, 0.017, 0.016, 0.015];

// R1: slow diffusion RC [Ω/cell]  τ1 = 30 s
const R1_TABLE = [0.015, 0.012, 0.010, 0.009, 0.008, 0.007, 0.007, 0.006, 0.005];

// R2: fast surface-film RC [Ω/cell]  τ2 = 5 s
const R2_TABLE = [0.008, 0.007, 0.006, 0.005, 0.004, 0.004, 0.003, 0.003, 0.002];

export const TAU1_S = 30;  // diffusion time constant [s]
export const TAU2_S = 5;   // surface-film time constant [s]

// ── Interpolation helper ──────────────────────────────────────────────────
function lerpTable(soc: number, table: number[]): number {
  const s = Math.max(SOC_PTS[0], Math.min(SOC_PTS[SOC_PTS.length - 1], soc));
  for (let i = 0; i < SOC_PTS.length - 1; i++) {
    if (s >= SOC_PTS[i] && s <= SOC_PTS[i + 1]) {
      const t = (s - SOC_PTS[i]) / (SOC_PTS[i + 1] - SOC_PTS[i]);
      return table[i] + t * (table[i + 1] - table[i]);
    }
  }
  return table[table.length - 1];
}

/** Per-cell R0 at given SOC [Ω/cell] (before temperature correction) */
export function r0Cell(soc: number): number {
  return lerpTable(soc, R0_TABLE);
}

/** Per-cell R1 at given SOC [Ω/cell] */
export function r1Cell(soc: number): number {
  return lerpTable(soc, R1_TABLE);
}

/** Per-cell R2 at given SOC [Ω/cell] */
export function r2Cell(soc: number): number {
  return lerpTable(soc, R2_TABLE);
}

/**
 * Arrhenius temperature correction for ohmic resistance.
 * r0_corrected = r0_ref · exp(0.04 · (25 − T_celsius))
 */
export function r0TempCorrect(r0_ref_Ohm: number, T_celsius: number): number {
  return r0_ref_Ohm * Math.exp(0.04 * (25 - T_celsius));
}

/**
 * Advance both RC elements one time step.
 * Returns [V_rc1_new, V_rc2_new].
 */
export function step2RC(
  V_rc1: number,
  V_rc2: number,
  I: number,        // pack current [A]
  R1_pack: number,  // pack R1 [Ω]
  R2_pack: number,  // pack R2 [Ω]
  dt: number,
): [number, number] {
  return [
    stepRC(V_rc1, I, R1_pack, TAU1_S, dt),
    stepRC(V_rc2, I, R2_pack, TAU2_S, dt),
  ];
}

/** Terminal voltage: V_oc − I·R0 − V_rc1 − V_rc2 */
export function terminalVoltage(
  V_oc: number,
  I: number,
  R0_pack: number,
  V_rc1: number,
  V_rc2: number,
): number {
  return V_oc - I * R0_pack - V_rc1 - V_rc2;
}

// ── Pack-level step ───────────────────────────────────────────────────────

/**
 * Maximum power the pack can deliver at the current state [W].
 * Uses matched-impedance formula: P_max = V_eff² / (4·R0_pack)
 * where V_eff = V_oc − V_rc1 − V_rc2 (net driving EMF).
 */
export function packMaxPowerW(
  soc: number,
  V_rc1: number,
  V_rc2: number,
  pack_series: number,
  pack_parallel: number,
  T_celsius: number,
): number {
  const V_oc = ocvPack(soc, pack_series);
  const R0 = r0TempCorrect(r0Cell(soc), T_celsius) * pack_series / pack_parallel;
  const V_eff = Math.max(0, V_oc - V_rc1 - V_rc2);
  return V_eff * V_eff / (4 * R0);
}

export interface Battery2RCResult {
  I_bat: number;
  V_bat: number;
  V_rc1: number;
  V_rc2: number;
  soc_new: number;
  wh_new: number;
}

/**
 * One integration step of the 2RC Thevenin pack model.
 *
 * @param soc         State of charge [0–1]
 * @param wh_em       Cumulative Wh drawn so far
 * @param V_rc1       RC1 element voltage [V]
 * @param V_rc2       RC2 element voltage [V]
 * @param pack_series Number of cells in series
 * @param pack_parallel Number of parallel strings
 * @param pack_Q_Ah   Total pack capacity [Ah] (all strings combined)
 * @param T_celsius   Cell temperature [°C]
 * @param P_elec_W    Electrical power demanded from pack [W]
 * @param dt          Time step [s]
 */
export function battery2RCStep(
  soc: number,
  wh_em: number,
  V_rc1: number,
  V_rc2: number,
  pack_series: number,
  pack_parallel: number,
  pack_Q_Ah: number,
  T_celsius: number,
  P_elec_W: number,
  dt: number,
): Battery2RCResult {
  const V_oc = ocvPack(soc, pack_series);

  // Per-cell resistances → pack (series raises V, parallel divides R)
  const r0_corrected = r0TempCorrect(r0Cell(soc), T_celsius);
  const R0_pack = r0_corrected * pack_series / pack_parallel;
  const R1_pack = r1Cell(soc) * pack_series / pack_parallel;
  const R2_pack = r2Cell(soc) * pack_series / pack_parallel;

  // Solve for current given power demand:
  //   P = V_terminal · I  and  V_terminal = V_oc − I·R0 − V_rc1 − V_rc2
  //   → I²·R0 + I·(V_rc1 + V_rc2 − V_oc) + P = 0
  const V_rc_sum = V_rc1 + V_rc2;
  const disc = (V_oc - V_rc_sum) ** 2 - 4 * R0_pack * P_elec_W;
  let I_bat: number;
  if (disc < 0) {
    // Power exceeds what pack can deliver — current-limited
    I_bat = (V_oc - V_rc_sum) / (2 * R0_pack);
  } else {
    I_bat = ((V_oc - V_rc_sum) - Math.sqrt(disc)) / (2 * R0_pack);
  }
  I_bat = Math.max(0, I_bat);

  const V_bat = terminalVoltage(V_oc, I_bat, R0_pack, V_rc1, V_rc2);
  const [V_rc1_new, V_rc2_new] = step2RC(V_rc1, V_rc2, I_bat, R1_pack, R2_pack, dt);

  const soc_new = Math.max(0.005, soc - I_bat * dt / (3600 * pack_Q_Ah));
  const wh_new = wh_em + V_bat * I_bat * dt / 3600;

  return {
    I_bat,
    V_bat,
    V_rc1: V_rc1_new,
    V_rc2: V_rc2_new,
    soc_new,
    wh_new,
  };
}
