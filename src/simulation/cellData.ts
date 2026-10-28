/**
 * EP9343126VVP cell data (Hongkong Mingda, spec EP210828033 V1.01).
 * HV LiCoO2 pouch, 6.6 Ah, 4.45 V max — the FSO M06H HSC cell (13S2P).
 *
 * Everything marked "datasheet" is read directly from the spec.
 * Everything marked "estimate" is NOT in the datasheet and must be replaced
 * with a measurement (C/10 OCV test, pulse test) before results are used
 * for sizing decisions.
 */

// ── Datasheet limits (per cell) ───────────────────────────────────────────
export const CELL_CAPACITY_AH = 6.6;          // datasheet, 0.2C to 2.75 V
export const CELL_V_MAX = 4.45;               // datasheet, charge cut-off
export const CELL_V_NOM = 3.90;               // datasheet, average at 1C
export const CELL_V_MIN = 2.75;               // datasheet, discharge cut-off
export const CELL_R_AC_TYP_OHM = 0.0021;      // datasheet, 1 kHz AC, typical
export const CELL_R_AC_MAX_OHM = 0.0025;      // datasheet, 1 kHz AC, max
export const CELL_I_DIS_CONT_A = 99;          // datasheet, 15C
export const CELL_I_DIS_PEAK_A = 165;         // datasheet, 25C
export const CELL_I_DIS_PEAK_S = 3;           // datasheet
export const CELL_I_CHG_CONT_A = 26.4;        // datasheet, 4C
export const CELL_I_CHG_PEAK_A = 53;          // datasheet, 8C
export const CELL_I_CHG_PEAK_S = 3;           // datasheet
export const CELL_T_DIS_MIN_C = -20;          // datasheet
export const CELL_T_DIS_MAX_C = 60;           // datasheet (also FSG T11.7.7 ceiling)
export const CELL_T_CHG_MIN_C = 0;            // datasheet
export const CELL_T_CHG_MAX_C = 45;           // datasheet
export const CELL_MASS_KG = 0.102;            // datasheet
export const CELL_CYCLES_TO_80PCT = 300;      // datasheet, 1C, minimum

/** Capacity fade per cycle implied by the datasheet guarantee (≥300 cycles to 80 %). */
export const KQ_DATASHEET = 0.2 / CELL_CYCLES_TO_80PCT;

// ── OCV curve (estimate) ──────────────────────────────────────────────────
// Typical shape of a 4.45 V high-voltage LiCoO2/graphite cell, anchored to the
// datasheet: ≥4.45 V after full charge, 3.90 V average at 1C, 2.75 V cut-off.
// Replace with a measured C/10 or GITT curve of one EP9343126VVP cell.
export const OCV_SOC_PTS = [0.00, 0.05, 0.10, 0.20, 0.30, 0.40, 0.50, 0.60, 0.70, 0.80, 0.90, 1.00];
export const OCV_CELL_V  = [3.30, 3.58, 3.68, 3.76, 3.81, 3.86, 3.92, 3.99, 4.07, 4.17, 4.29, 4.43];

// ── ECM defaults (estimate) ───────────────────────────────────────────────
// Pack R0 24 mΩ: 13 × 2.1 mΩ / 2 = 13.7 mΩ AC for the cells, plus DC/AC
// difference and busbars. RC terms are small for a 15C power pouch cell.
export const DEFAULT_PACK_R0_MOHM = 24;
export const DEFAULT_R1_MOHM = 1.0;   // per cell, fast RC
export const DEFAULT_TAU1_S = 5;
export const DEFAULT_R2_MOHM = 1.0;   // per cell, slow RC
export const DEFAULT_TAU2_S = 50;

/** Piecewise-linear interpolation in the OCV table, SOC clamped to [0, 1]. */
export function ocvCellTable(soc: number): number {
  const s = Math.max(0, Math.min(1, soc));
  for (let i = 0; i < OCV_SOC_PTS.length - 1; i++) {
    if (s <= OCV_SOC_PTS[i + 1]) {
      const t = (s - OCV_SOC_PTS[i]) / (OCV_SOC_PTS[i + 1] - OCV_SOC_PTS[i]);
      return OCV_CELL_V[i] + t * (OCV_CELL_V[i + 1] - OCV_CELL_V[i]);
    }
  }
  return OCV_CELL_V[OCV_CELL_V.length - 1];
}

/** Pack-level current limits [A] for a pack with `parallel` strings. */
export function packCurrentLimits(parallel: number) {
  return {
    dis_cont: CELL_I_DIS_CONT_A * parallel,
    dis_peak: CELL_I_DIS_PEAK_A * parallel,
    chg_cont: CELL_I_CHG_CONT_A * parallel,
    chg_peak: CELL_I_CHG_PEAK_A * parallel,
  };
}
