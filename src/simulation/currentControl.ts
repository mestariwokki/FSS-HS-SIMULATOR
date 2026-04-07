import type { SimMode, ProfileStep, PackConfig } from '../types';

export interface CurrentParams {
  mode: SimMode;
  // Const mode
  current_A: number;
  duration_s: number;
  // Profile mode
  profileSteps: ProfileStep[];
  // Charge mode
  charge_current_A: number;
  cutoff_current_A: number;
  charge_duration_s: number;
  cv_t_start: number | null;
}

export interface CurrentResult {
  i: number;
  done: boolean;
  cv_t_start: number | null;
}

export function getNextCurrent(
  t: number,
  v_t: number,
  params: CurrentParams,
  pack: PackConfig,
): CurrentResult {
  if (params.mode === 'const') {
    return {
      i: params.current_A,
      done: t >= params.duration_s,
      cv_t_start: params.cv_t_start,
    };
  }

  if (params.mode === 'profile') {
    let elapsed = 0;
    for (const s of params.profileSteps) {
      elapsed += s.duration_s;
      if (t < elapsed) {
        return { i: s.current_A, done: false, cv_t_start: params.cv_t_start };
      }
    }
    return { i: 0, done: true, cv_t_start: params.cv_t_start };
  }

  if (params.mode === 'charge') {
    const cc = params.charge_current_A;
    const cut = params.cutoff_current_A;
    const dur = params.charge_duration_s;
    const v_max = pack.v_max;

    if (t >= dur) return { i: 0, done: true, cv_t_start: params.cv_t_start };

    // CC phase: constant negative current (charging)
    if (v_t < v_max - 0.05) {
      return { i: -cc, done: false, cv_t_start: params.cv_t_start };
    }

    // CV phase: current decays to keep V at V_max
    let cv_start = params.cv_t_start;
    if (cv_start === null) cv_start = t;
    const tau = 0.15 * (pack.capacity_Ah * 3600 / cc);
    const i_cv = -cc * Math.exp(-(t - cv_start) / tau);
    if (Math.abs(i_cv) < cut) {
      return { i: 0, done: true, cv_t_start: cv_start };
    }
    return { i: i_cv, done: false, cv_t_start: cv_start };
  }

  return { i: 0, done: true, cv_t_start: params.cv_t_start };
}
