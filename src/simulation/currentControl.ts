import type { SimMode, ProfileStep, PackConfig } from '../types';

export interface CurrentParams {
  mode: SimMode;
  ambient_C?: number;
  // Const mode
  current_A: number;
  duration_s: number;
  // Profile mode
  profileSteps: ProfileStep[];
  // Charge mode
  charge_current_A: number;
  cutoff_current_A: number;
  charge_duration_s: number;
}

export interface CurrentResult {
  ambient_C?: number;
  i: number;
  done: boolean;
}

export function getNextCurrent(
  t: number,
  params: CurrentParams,
  pack: PackConfig,
  predictVoltage: (current_A: number) => number,
): CurrentResult {
  if (params.mode === 'const') {
    return {
      i: params.current_A,
      ambient_C: params.ambient_C,
      done: t >= params.duration_s,
    };
  }

  if (params.mode === 'profile') {
    let elapsed = 0;
    for (const s of params.profileSteps) {
      elapsed += s.duration_s;
      if (t < elapsed) {
        return { i: s.current_A, ambient_C: s.ambient_C ?? params.ambient_C, done: false };
      }
    }
    return { i: 0, done: true };
  }

  if (params.mode === 'charge') {
    const cc = params.charge_current_A;
    const cut = params.cutoff_current_A;
    const dur = params.charge_duration_s;
    const v_max = pack.v_max;

    if (t >= dur) return { i: 0, done: true };

    if (predictVoltage(-cc) <= v_max) {
      return { i: -cc, ambient_C: params.ambient_C, done: false };
    }

    if (predictVoltage(0) >= v_max) return { i: 0, done: true };

    // Solve the terminal-voltage constraint within the charger's current range.
    let safeCurrent = 0;
    let higherCurrent = cc;
    while (higherCurrent - safeCurrent > 0.001) {
      const candidate = (safeCurrent + higherCurrent) / 2;
      if (predictVoltage(-candidate) <= v_max) safeCurrent = candidate;
      else higherCurrent = candidate;
    }
    if (safeCurrent <= cut) return { i: 0, done: true };
    return { i: -safeCurrent, ambient_C: params.ambient_C, done: false };
  }

  return { i: 0, done: true };
}
