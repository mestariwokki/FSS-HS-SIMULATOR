/**
 * Fit the cell and HSC model parameters to test data.
 *
 *   fitOcv          — C/10 (or slower) discharge and charge of one cell → OCV table
 *   fitHppc         — current pulses at one temperature → R0, R1/τ1, R2/τ2 per SOC
 *   fitArrhenius    — HPPC results at several temperatures → activation energies
 *   fitStackThermal — built stack, constant-current heating + cool-down → C, UA
 *
 * All functions take plain arrays (t [s], I [A, > 0 discharge], V [V], T [°C])
 * so they work with any logger once the CSV is read (see readCsv).
 * Test procedures and CSV format: docs/calibration.md.
 */
import { OCV_SOC_PTS } from '../simulation/cellData';
import { interp1 } from '../simulation/cellModel';

const R_GAS = 8.31446;

// ── CSV ───────────────────────────────────────────────────────────────────

export interface Series {
  t: number[];
  I: number[];
  V: number[];
  T: number[];
  extra: Record<string, number[]>;
}

const ALIASES: Record<'t' | 'I' | 'V' | 'T', string[]> = {
  t: ['t', 't_s', 'time', 'time_s', 'aika'],
  I: ['i', 'i_a', 'current', 'current_a', 'virta'],
  V: ['v', 'v_v', 'u', 'voltage', 'voltage_v', 'jannite', 'jännite'],
  T: ['t_c', 'temp', 'temp_c', 'temperature', 'lampotila', 'lämpötila', 't_cell'],
};

/**
 * Read a CSV/TSV/semicolon file with a header row. Columns are matched by
 * name (case-insensitive, see ALIASES); everything else lands in `extra`.
 * Decimal commas are accepted when the separator is ';' or a tab.
 * Discharge current must be positive: pass `flipCurrent` if your logger
 * records discharge as negative.
 */
export function readCsv(text: string, flipCurrent = false): Series {
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== '' && !l.startsWith('#'));
  const sep = lines[0].includes(';') ? ';' : lines[0].includes('\t') ? '\t' : ',';
  const head = lines[0].split(sep).map(h => h.trim().toLowerCase());
  const col = (k: keyof typeof ALIASES) => head.findIndex(h => ALIASES[k].includes(h));
  const idx = { t: col('t'), I: col('I'), V: col('V'), T: col('T') };
  const num = (s: string | undefined) => {
    if (s === undefined) return NaN;
    return parseFloat(sep !== ',' ? s.replace(',', '.') : s);
  };
  const out: Series = { t: [], I: [], V: [], T: [], extra: {} };
  const used = new Set(Object.values(idx));
  head.forEach((h, i) => { if (!used.has(i)) out.extra[h] = []; });
  for (const line of lines.slice(1)) {
    const c = line.split(sep);
    out.t.push(num(c[idx.t]));
    out.I.push(idx.I >= 0 ? num(c[idx.I]) * (flipCurrent ? -1 : 1) : 0);
    out.V.push(idx.V >= 0 ? num(c[idx.V]) : NaN);
    out.T.push(idx.T >= 0 ? num(c[idx.T]) : NaN);
    head.forEach((h, i) => { if (!used.has(i)) out.extra[h].push(num(c[i])); });
  }
  return out;
}

/** Ah discharged since the first sample (trapezoid). */
export function coulombCount(t: number[], I: number[]): number[] {
  const ah = [0];
  for (let i = 1; i < t.length; i++) ah.push(ah[i - 1] + 0.5 * (I[i] + I[i - 1]) * (t[i] - t[i - 1]) / 3600);
  return ah;
}

// ── OCV ───────────────────────────────────────────────────────────────────

export interface OcvFit {
  capacity_Ah: number;
  soc: number[];
  ocv: number[];
  method: 'charge+discharge average' | 'discharge + I·R correction';
}

/**
 * OCV table from a slow full discharge (from 100 % to cut-off) and, if given,
 * the following slow full charge. Averaging the two cancels the IR drop and
 * most of the hysteresis; with only a discharge, V + I·R_dc is used.
 */
export function fitOcv(dis: Series, chg?: Series, R_dc_Ohm = 0.003, socPts = OCV_SOC_PTS): OcvFit {
  const ahD = coulombCount(dis.t, dis.I);
  const Q = ahD[ahD.length - 1];
  const socD = ahD.map(a => 1 - a / Q);
  // interp1 needs ascending x
  const ascD = socD.map((s, i) => [s, dis.V[i] + dis.I[i] * (chg ? 0 : R_dc_Ohm)] as const).reverse();
  const xD = ascD.map(p => p[0]), yD = ascD.map(p => p[1]);
  let ocv: number[];
  if (chg) {
    const ahC = coulombCount(chg.t, chg.I.map(i => -i));     // charge current positive here
    const Qc = ahC[ahC.length - 1];
    const xC = ahC.map(a => a / Qc);                          // 0 → 1 while charging
    const yC = chg.V;
    ocv = socPts.map(s => 0.5 * (interp1(s, xD, yD) + interp1(s, xC, yC)));
  } else {
    ocv = socPts.map(s => interp1(s, xD, yD));
  }
  return { capacity_Ah: Q, soc: [...socPts], ocv, method: chg ? 'charge+discharge average' : 'discharge + I·R correction' };
}

// ── HPPC ──────────────────────────────────────────────────────────────────

export interface PulseFit {
  soc: number;
  I: number;
  R0: number;
  R1: number;
  tau1: number;
  R2: number;
  tau2: number;
  rmse_mV: number;
}

/** Find constant-current pulses: |I| above threshold, at least minLen seconds. */
export function findPulses(s: Series, I_thr: number, minLen = 2): { i0: number; i1: number }[] {
  const out: { i0: number; i1: number }[] = [];
  let i0 = -1;
  for (let i = 0; i < s.t.length; i++) {
    const on = Math.abs(s.I[i]) > I_thr;
    if (on && i0 < 0) i0 = i;
    if ((!on || i === s.t.length - 1) && i0 >= 0) {
      const i1 = on ? i : i - 1;
      if (s.t[i1] - s.t[i0] >= minLen) out.push({ i0, i1 });
      i0 = -1;
    }
  }
  return out;
}

/** Least squares a·x + b·y ≈ z, returns [a, b]. */
function lsq2(x: number[], y: number[], z: number[]): [number, number] {
  let sxx = 0, syy = 0, sxy = 0, sxz = 0, syz = 0;
  for (let i = 0; i < x.length; i++) {
    sxx += x[i] * x[i]; syy += y[i] * y[i]; sxy += x[i] * y[i];
    sxz += x[i] * z[i]; syz += y[i] * z[i];
  }
  const det = sxx * syy - sxy * sxy;
  if (Math.abs(det) < 1e-18) return [sxz / Math.max(sxx, 1e-18), 0];
  return [(sxz * syy - syz * sxy) / det, (syz * sxx - sxz * sxy) / det];
}

/**
 * Fit R0 and two RC pairs to one pulse AND the rest that follows it:
 *   during the pulse (0 < t < Tp):  ΔV/I = R0 + Σ R_k (1 − e^(−t/τk))
 *   after it        (t > Tp):       ΔV/I = Σ R_k (1 − e^(−Tp/τk)) e^(−(t−Tp)/τk)
 * The relaxation is what separates the slow (diffusion) RC from the fast one.
 * The OCV drop from the charge taken out during the pulse (dVdAh · Ah, from
 * the relaxed voltages before neighbouring pulses) is removed first, or it
 * would look like a huge slow RC term.
 * R0 from the instantaneous step, (τ1, τ2) by grid search, R1/R2 by linear LSQ.
 */
export function fitPulse(s: Series, i0: number, i1: number, soc: number, dVdAh = 0, rest_s = 120): PulseFit {
  const Vrest = s.V[Math.max(0, i0 - 1)];
  const I = s.I.slice(i0, i1 + 1).reduce((a, b) => a + b, 0) / (i1 - i0 + 1);
  const t0 = s.t[Math.max(0, i0 - 1)];
  const Tp = s.t[i1] - t0 + (s.t[Math.min(s.t.length - 1, i1 + 1)] - s.t[i1]);
  // window: the pulse, then the rest until the current changes again (max rest_s)
  let iEnd = i1;
  while (iEnd + 1 < s.t.length && Math.abs(s.I[iEnd + 1]) < 0.02 * Math.abs(I) && s.t[iEnd + 1] - s.t[i1] <= rest_s) iEnd++;
  const tt: number[] = [], dv: number[] = [], on: boolean[] = [];
  let ah = 0;
  for (let i = i0; i <= iEnd; i++) {
    if (i > i0) ah += 0.5 * (s.I[i] + s.I[i - 1]) * (s.t[i] - s.t[i - 1]) / 3600;
    tt.push(s.t[i] - t0); dv.push((Vrest - s.V[i] - dVdAh * ah) / I); on.push(i <= i1);
  }
  // R0: first sample after the step (the logger's sample period sets the accuracy)
  const R0 = dv[0];
  const z = dv.map((d, i) => d - (on[i] ? R0 : 0));
  const basis = (tau: number) => tt.map((t, i) => on[i]
    ? 1 - Math.exp(-t / tau)
    : (1 - Math.exp(-Tp / tau)) * Math.exp(-(t - Tp) / tau));
  let best: PulseFit = { soc, I, R0, R1: 0, tau1: 1, R2: 0, tau2: 30, rmse_mV: Infinity };
  const taus1 = [0.3, 0.5, 0.75, 1, 1.5, 2, 3, 4, 6, 8];
  const taus2 = [10, 15, 20, 25, 30, 40, 50, 60, 90, 120, 180];
  for (const ta of taus1) for (const tb of taus2) {
    const x = basis(ta);
    const y = basis(tb);
    const [R1, R2] = lsq2(x, y, z);
    if (R1 < 0 || R2 < 0) continue;
    let se = 0;
    for (let i = 0; i < z.length; i++) { const e = z[i] - R1 * x[i] - R2 * y[i]; se += e * e; }
    const rmse = Math.sqrt(se / z.length) * Math.abs(I) * 1000;
    if (rmse < best.rmse_mV) best = { soc, I, R0, R1, tau1: ta, R2, tau2: tb, rmse_mV: rmse };
  }
  return best;
}

/**
 * HPPC test at one temperature, starting fully charged. Every discharge
 * pulse above I_thr gives one fit; SOC from coulomb counting.
 */
export function fitHppc(s: Series, capacity_Ah: number, I_thr = 5, soc0 = 1): PulseFit[] {
  const ah = coulombCount(s.t, s.I);
  const pulses = findPulses(s, I_thr).filter(p => s.I[p.i0] > 0);
  // OCV slope [V/Ah] between the relaxed voltages before consecutive pulses
  const pre = pulses.map(p => Math.max(0, p.i0 - 1));
  const slope = pre.map((i, k) => {
    const j = pre[Math.min(pre.length - 1, k + 1)], h = pre[Math.max(0, k - 1)];
    const [a, b] = j !== i ? [i, j] : [h, i];
    const dAh = ah[b] - ah[a];
    return dAh > 1e-6 ? (s.V[a] - s.V[b]) / dAh : 0;
  });
  return pulses.map((p, k) => fitPulse(s, p.i0, p.i1, soc0 - ah[pre[k]] / capacity_Ah, slope[k]));
}

// ── Temperature dependence ────────────────────────────────────────────────

/** ln R = ln A + Ea/(R·T) → Ea [J/mol] from (T °C, R) pairs. */
export function fitArrhenius(points: { T_C: number; R: number }[]): { Ea: number; R25: number } {
  const x = points.map(p => 1 / (p.T_C + 273.15));
  const y = points.map(p => Math.log(p.R));
  const n = x.length;
  const mx = x.reduce((a, b) => a + b, 0) / n, my = y.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0;
  for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; }
  const slope = sxy / sxx;
  const lnA = my - slope * mx;
  return { Ea: slope * R_GAS, R25: Math.exp(lnA + slope / 298.15) };
}

/** Summarise HPPC fits into cellModel.ts parameters (values at 50 % SOC + SOC factors). */
export function summariseHppc(fits: PulseFit[], socPts = [0.05, 0.1, 0.2, 0.3, 0.5, 0.8, 0.95]) {
  const sorted = [...fits].sort((a, b) => a.soc - b.soc);
  const xs = sorted.map(f => f.soc);
  const at = (k: 'R0' | 'R1' | 'R2' | 'tau1' | 'tau2', s: number) => interp1(s, xs, sorted.map(f => f[k]));
  const R0_50 = at('R0', 0.5), R2_50 = at('R2', 0.5);
  return {
    R0_ref_Ohm: R0_50,
    R1_ref_Ohm: at('R1', 0.5),
    tau1_s: median(sorted.map(f => f.tau1)),
    R2_ref_Ohm: R2_50,
    tau2_s: median(sorted.map(f => f.tau2)),
    r_soc_pts: socPts,
    r0_soc_fac: socPts.map(s => at('R0', s) / R0_50),
    r2_soc_fac: socPts.map(s => at('R2', s) / R2_50),
  };
}

function median(a: number[]): number {
  const s = [...a].sort((x, y) => x - y);
  return s.length ? s[Math.floor(s.length / 2)] : NaN;
}

// ── Stack thermal ─────────────────────────────────────────────────────────

export interface ThermalFit {
  /** Effective heat capacity of the measured cell incl. its share of structure [J/K] */
  C_JK: number;
  /** Effective conductance of that cell to ambient [W/K] */
  UA_WK: number;
  tau_s: number;
  rmse_K: number;
}

/**
 * Lumped fit of one temperature sensor: C·dT/dt = q(t) − UA·(T − T_amb).
 * q(t) is the heat of ONE cell, I_cell²·R (pass the pack current and the
 * number of parallel strings). The cool-down part fixes τ = C/UA; the
 * heating part fixes C. Fit by grid search on τ with linear LSQ for C.
 */
export function fitStackThermal(
  t: number[], I_pack: number[], T: number[], T_amb: number[] | number,
  parallel: number, R_cell_Ohm: number,
): ThermalFit {
  const amb = (i: number) => (typeof T_amb === 'number' ? T_amb : T_amb[i]);
  let best: ThermalFit = { C_JK: NaN, UA_WK: NaN, tau_s: NaN, rmse_K: Infinity };
  for (let tau = 30; tau <= 20000; tau *= 1.05) {
    // Simulate unit response with C = 1: T' = q − (T−Ta)/τ  → θ(t) linear in 1/C
    // θ = T − T_amb; θ_k+1 = θ_k·e^(−dt/τ) + (q/C)·τ(1 − e^(−dt/τ))
    const resp: number[] = [0];
    const free: number[] = [T[0] - amb(0)];
    for (let i = 1; i < t.length; i++) {
      const dt = t[i] - t[i - 1];
      const a = Math.exp(-dt / tau);
      const Icell = I_pack[i - 1] / parallel;
      const q = Icell * Icell * R_cell_Ohm;
      resp.push(resp[i - 1] * a + q * tau * (1 - a));
      free.push(free[i - 1] * a);
    }
    let sxz = 0, sxx = 0;
    for (let i = 0; i < t.length; i++) {
      const z = T[i] - amb(i) - free[i];
      sxz += resp[i] * z; sxx += resp[i] * resp[i];
    }
    const invC = sxx > 0 ? sxz / sxx : 0;
    if (invC <= 0) continue;
    let se = 0;
    for (let i = 0; i < t.length; i++) {
      const e = T[i] - amb(i) - free[i] - invC * resp[i];
      se += e * e;
    }
    const rmse = Math.sqrt(se / t.length);
    if (rmse < best.rmse_K) best = { C_JK: 1 / invC, UA_WK: 1 / (invC * tau), tau_s: tau, rmse_K: rmse };
  }
  return best;
}
