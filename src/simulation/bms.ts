/**
 * BMS / protection model for the HSC, per FSG T11.7.7 and the EP9343126VVP datasheet.
 *
 * T11.7.7: overcurrent protection at or below the cells' max specified discharge
 * current; cell temperature outside the datasheet range (≤ 60 °C) for > 1 s and
 * cell voltage outside the datasheet range for > 500 ms must disconnect the HSC.
 *
 * Current: continuous rating may be exceeded only up to the datasheet peak and
 * only for the datasheet peak time (3 s), for discharge and charge alike.
 * Cell voltage is approximated as V_pack / S (no cell imbalance modelled).
 */
import {
  CELL_V_MAX, CELL_V_MIN,
  CELL_T_DIS_MIN_C, CELL_T_DIS_MAX_C, CELL_T_CHG_MIN_C, CELL_T_CHG_MAX_C,
  CELL_I_DIS_PEAK_S, CELL_I_CHG_PEAK_S,
  packCurrentLimits,
} from './cellData';

export const BMS_VOLTAGE_DELAY_S = 0.5;
export const BMS_TEMP_DELAY_S = 1.0;

export interface BmsLimits {
  v_cell_min: number;
  v_cell_max: number;
  i_dis_cont: number;
  i_dis_peak: number;
  i_dis_peak_s: number;
  i_chg_cont: number;
  i_chg_peak: number;
  i_chg_peak_s: number;
  t_dis_min_C: number;
  t_dis_max_C: number;
  t_chg_min_C: number;
  t_chg_max_C: number;
}

export function defaultBmsLimits(parallel: number, t_max_C = CELL_T_DIS_MAX_C): BmsLimits {
  const lim = packCurrentLimits(parallel);
  return {
    v_cell_min: CELL_V_MIN,
    v_cell_max: CELL_V_MAX,
    i_dis_cont: lim.dis_cont,
    i_dis_peak: lim.dis_peak,
    i_dis_peak_s: CELL_I_DIS_PEAK_S,
    i_chg_cont: lim.chg_cont,
    i_chg_peak: lim.chg_peak,
    i_chg_peak_s: CELL_I_CHG_PEAK_S,
    t_dis_min_C: CELL_T_DIS_MIN_C,
    t_dis_max_C: Math.min(t_max_C, CELL_T_DIS_MAX_C),
    t_chg_min_C: CELL_T_CHG_MIN_C,
    t_chg_max_C: CELL_T_CHG_MAX_C,
  };
}

export interface BmsTimers {
  uv_s: number;
  ov_s: number;
  ot_s: number;
  dis_peak_s: number;
  chg_peak_s: number;
}

export const BMS_TIMERS_ZERO: BmsTimers = { uv_s: 0, ov_s: 0, ot_s: 0, dis_peak_s: 0, chg_peak_s: 0 };

export interface BmsResult {
  timers: BmsTimers;
  trip: string | null;
}

/**
 * Advance the protection timers one step and report a trip (AIR opens) if any.
 * @param I_pack  pack current [A], > 0 discharge, < 0 charge
 */
export function bmsCheck(
  timers: BmsTimers,
  lim: BmsLimits,
  V_pack: number,
  series: number,
  I_pack: number,
  T_C: number,
  dt: number,
): BmsResult {
  const v_cell = V_pack / series;
  const charging = I_pack < 0;
  const I_chg = -I_pack;

  const uv_s = v_cell < lim.v_cell_min ? timers.uv_s + dt : 0;
  const ov_s = v_cell > lim.v_cell_max ? timers.ov_s + dt : 0;
  const t_lo = charging ? lim.t_chg_min_C : lim.t_dis_min_C;
  const t_hi = charging ? lim.t_chg_max_C : lim.t_dis_max_C;
  const ot_s = (T_C > t_hi || T_C < t_lo) ? timers.ot_s + dt : 0;
  const dis_peak_s = I_pack > lim.i_dis_cont ? timers.dis_peak_s + dt : 0;
  const chg_peak_s = I_chg > lim.i_chg_cont ? timers.chg_peak_s + dt : 0;
  const next: BmsTimers = { uv_s, ov_s, ot_s, dis_peak_s, chg_peak_s };

  // Round to the step so that e.g. 5 × 0.1 s counts as 0.5 s
  const over = (t: number, limit: number) => t > limit + 1e-9;

  let trip: string | null = null;
  if (I_pack > lim.i_dis_peak) {
    trip = `BMS: discharge ${I_pack.toFixed(0)} A > peak ${lim.i_dis_peak.toFixed(0)} A`;
  } else if (over(dis_peak_s, lim.i_dis_peak_s)) {
    trip = `BMS: discharge > ${lim.i_dis_cont.toFixed(0)} A for over ${lim.i_dis_peak_s} s`;
  } else if (I_chg > lim.i_chg_peak) {
    trip = `BMS: charge ${I_chg.toFixed(0)} A > peak ${lim.i_chg_peak.toFixed(0)} A`;
  } else if (over(chg_peak_s, lim.i_chg_peak_s)) {
    trip = `BMS: charge > ${lim.i_chg_cont.toFixed(1)} A for over ${lim.i_chg_peak_s} s`;
  } else if (over(uv_s, BMS_VOLTAGE_DELAY_S)) {
    trip = `BMS: cell undervoltage ${v_cell.toFixed(3)} V < ${lim.v_cell_min} V`;
  } else if (over(ov_s, BMS_VOLTAGE_DELAY_S)) {
    trip = `BMS: cell overvoltage ${v_cell.toFixed(3)} V > ${lim.v_cell_max} V`;
  } else if (over(ot_s, BMS_TEMP_DELAY_S)) {
    trip = `BMS: cell temperature ${T_C.toFixed(1)} °C outside ${t_lo}…${t_hi} °C (${charging ? 'charge' : 'discharge'})`;
  }
  return { timers: next, trip };
}
