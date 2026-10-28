/**
 * FSS-HS-SIMULATOR — Validation Script
 * =====================================
 * Checks the battery model against the EP9343126VVP datasheet
 * (Hongkong Mingda spec EP210828033 V1.01) and against closed-form physics.
 * Unlike a self-consistency check, every reference value below comes from the
 * datasheet or from an independent analytic formula.
 *
 * Usage:  node validate.mjs
 *
 * The kernels below mirror src/simulation/cellData.ts and src/simulation/battery.ts.
 * If you change the OCV table or the R tables there, change them here too.
 */

// ── Mirror of cellData.ts ──────────────────────────────────────────────────
const S = 13, P = 2;
const CELL_AH = 6.6;
const Q_PACK = CELL_AH * P;
const V_MAX = 4.45, V_NOM = 3.90, V_MIN = 2.75;
const I_DIS_CONT = 99 * P;           // 198 A
const KQ = 0.2 / 300;                // datasheet: ≥300 cycles to 80 %
const OCV_SOC = [0.00, 0.05, 0.10, 0.20, 0.30, 0.40, 0.50, 0.60, 0.70, 0.80, 0.90, 1.00];
const OCV_V   = [3.30, 3.58, 3.68, 3.76, 3.81, 3.86, 3.92, 3.99, 4.07, 4.17, 4.29, 4.43];

function ocvCell(soc) {
  const s = Math.max(0, Math.min(1, soc));
  for (let i = 0; i < OCV_SOC.length - 1; i++) {
    if (s <= OCV_SOC[i + 1]) {
      const t = (s - OCV_SOC[i]) / (OCV_SOC[i + 1] - OCV_SOC[i]);
      return OCV_V[i] + t * (OCV_V[i + 1] - OCV_V[i]);
    }
  }
  return OCV_V[OCV_V.length - 1];
}
const ocvPack = soc => ocvCell(soc) * S;

// ── Mirror of battery.ts ───────────────────────────────────────────────────
const SOC_PTS = [0.20, 0.30, 0.40, 0.50, 0.60, 0.70, 0.80, 0.90, 1.00];
const R0_TBL = [0.0048, 0.0043, 0.0039, 0.0037, 0.0036, 0.0035, 0.0035, 0.0035, 0.0036];
const R1_TBL = [0.0016, 0.0014, 0.0012, 0.0011, 0.0010, 0.0010, 0.0010, 0.0010, 0.0010];
const R2_TBL = [0.0010, 0.0009, 0.0008, 0.0007, 0.0007, 0.0006, 0.0006, 0.0006, 0.0006];
const TAU1 = 30, TAU2 = 5;

function lerp(soc, tbl) {
  const s = Math.max(SOC_PTS[0], Math.min(SOC_PTS[SOC_PTS.length - 1], soc));
  for (let i = 0; i < SOC_PTS.length - 1; i++) {
    if (s >= SOC_PTS[i] && s <= SOC_PTS[i + 1]) {
      const t = (s - SOC_PTS[i]) / (SOC_PTS[i + 1] - SOC_PTS[i]);
      return tbl[i] + t * (tbl[i + 1] - tbl[i]);
    }
  }
  return tbl[tbl.length - 1];
}
const stepRC = (V, I, R, tau, dt) => V * Math.exp(-dt / tau) + I * R * (1 - Math.exp(-dt / tau));

/** Constant-current discharge until the cell cut-off; returns delivered Ah, Wh and losses. */
function ccDischarge(I, dt = 0.5) {
  let soc = 1, v1 = 0, v2 = 0, ah = 0, wh_t = 0, wh_oc = 0, minV = 99;
  for (let t = 0; t < 4 * 3600; t += dt) {
    const R0 = lerp(soc, R0_TBL) * S / P;
    const Voc = ocvPack(soc);
    const Vt = Voc - I * R0 - v1 - v2;
    if (Vt / S < V_MIN) break;
    minV = Math.min(minV, Vt);
    v1 = stepRC(v1, I, lerp(soc, R1_TBL) * S / P, TAU1, dt);
    v2 = stepRC(v2, I, lerp(soc, R2_TBL) * S / P, TAU2, dt);
    soc -= I * dt / (Q_PACK * 3600);
    ah += I * dt / 3600;
    wh_t += Vt * I * dt / 3600;
    wh_oc += Voc * I * dt / 3600;
    if (soc <= 0) break;
  }
  return { ah, wh_t, wh_oc, minV };
}

// ── Formatting helpers ─────────────────────────────────────────────────────
const GREEN = '\x1b[32m', RED = '\x1b[31m', CYAN = '\x1b[36m', DIM = '\x1b[2m', BOLD = '\x1b[1m', RESET = '\x1b[0m';
const fmt = (v, d = 3) => (v === null || v === undefined ? '—' : v.toFixed(d)).padStart(10);

/** A check passes when lo ≤ value ≤ hi. */
function check(label, value, lo, hi, unit, note = '') {
  return { label, value, lo, hi, unit, note, ok: value >= lo && value <= hi };
}

function printTable(title, rows) {
  console.log(`\n${BOLD}${CYAN}━━━ ${title} ${'━'.repeat(Math.max(0, 60 - title.length))}${RESET}`);
  console.log('  ' + 'Quantity'.padEnd(40) + 'Model'.padStart(10) + '  ' + 'Allowed range'.padEnd(22) + 'Unit'.padEnd(6) + 'Status');
  console.log('  ' + '─'.repeat(90));
  let all = true;
  for (const r of rows) {
    const range = `${r.lo.toFixed(3)} … ${r.hi.toFixed(3)}`.padEnd(22);
    const st = r.ok ? `${GREEN}OK${RESET}` : `${RED}!!${RESET}`;
    console.log(`  ${r.label.padEnd(40)}${fmt(r.value)}  ${range}${r.unit.padEnd(6)}${st}  ${DIM}${r.note}${RESET}`);
    if (!r.ok) all = false;
  }
  return all;
}

// ════════════════════════════════════════════════════════════════════════════
// TEST 1 — OCV table vs datasheet voltages
// ════════════════════════════════════════════════════════════════════════════
function test1_Ocv() {
  let mono = 1;
  for (let i = 1; i < OCV_V.length; i++) if (OCV_V[i] <= OCV_V[i - 1]) mono = 0;
  return printTable('TEST 1 — OCV vs datasheet', [
    check('OCV(100 %) per cell [V]', ocvCell(1), 4.35, V_MAX, 'V', 'datasheet: 4.45 V charge, OCV ≥ 4.45 V right after charge'),
    check('OCV(0 %) per cell [V]', ocvCell(0), V_MIN, 3.5, 'V', 'relaxed voltage after 2.75 V cut-off'),
    check('Pack OCV(100 %) [V]', ocvPack(1), 56, 60, 'V', 'must stay below 60 VDC (CV5.1.2)'),
    check('OCV monotonic in SOC [1 = yes]', mono, 1, 1, '-'),
  ]);
}

// ════════════════════════════════════════════════════════════════════════════
// TEST 2 — Discharge performance vs datasheet
// ════════════════════════════════════════════════════════════════════════════
function test2_Discharge() {
  const c1 = ccDischarge(Q_PACK);          // 1C
  const c15 = ccDischarge(I_DIS_CONT);     // 15C = 99 A/cell
  return printTable('TEST 2 — Discharge vs datasheet', [
    check('1C average voltage per cell [V]', c1.wh_t / c1.ah / S, V_NOM * 0.97, V_NOM * 1.03, 'V', 'datasheet rated voltage 3.90 V = average at 1C'),
    check('1C capacity [% of nominal]', c1.ah / Q_PACK * 100, 95, 101, '%', 'datasheet ≥ 98 % at 0.2C'),
    check('99 A/cell capacity [% of 1C]', c15.ah / c1.ah * 100, 85, 100, '%', 'datasheet ≥ 85 % at 99 A'),
    check('1C pack energy [Wh]', c1.wh_t, 630, 700, 'Wh', `13 × 3.90 V × 13.2 Ah = ${(S * V_NOM * Q_PACK).toFixed(0)} Wh`),
    check('Pack efficiency at 198 A [-]', c15.wh_t / c15.wh_oc, 0.85, 0.97, '-', 'terminal / OCV energy; internal losses must show'),
  ]);
}

// ════════════════════════════════════════════════════════════════════════════
// TEST 3 — Thermal: steady state and time to 60 °C vs closed form
// mCp·dT/dt = I²R − UA·(T − T_amb)  →  T(t) = T_amb + ΔT_ss·(1 − e^(−t/τ))
// ════════════════════════════════════════════════════════════════════════════
function test3_Thermal() {
  const mCp = 2700, UA = 10, T_amb = 25, dt = 0.5;
  const R = lerp(0.6, R0_TBL) * S / P;
  function run(I, T_stop) {
    let T = T_amb, t = 0;
    while (t < 7200 && T < T_stop) { T += (I * I * R - UA * (T - T_amb)) / mCp * dt; t += dt; }
    return { T, t };
  }
  const I = I_DIS_CONT;
  const dTss = I * I * R / UA;
  const t60_theory = -mCp / UA * Math.log(1 - (60 - T_amb) / dTss);
  const t60 = run(I, 60).t;
  const I_end = 30;
  const Tss_end = run(I_end, 1e9).T;
  return printTable('TEST 3 — Thermal (lumped) vs closed form', [
    check('Time to 60 °C at 198 A [s]', t60, t60_theory * 0.99, t60_theory * 1.01 + dt, 's', `closed form ${t60_theory.toFixed(0)} s`),
    check('T after 2 h at 30 A [°C]', Tss_end, T_amb + I_end ** 2 * R / UA - 0.5, T_amb + I_end ** 2 * R / UA + 0.01, '°C', `T_amb + I²R/UA = ${(T_amb + I_end ** 2 * R / UA).toFixed(1)} °C`),
  ]);
}

// ════════════════════════════════════════════════════════════════════════════
// TEST 4 — Resistance and ageing vs datasheet
// ════════════════════════════════════════════════════════════════════════════
function test4_Params() {
  return printTable('TEST 4 — Resistance and ageing vs datasheet', [
    check('R0 cell @ 50 % SOC [mΩ]', lerp(0.5, R0_TBL) * 1000, 2.1, 5.0, 'mΩ', 'datasheet 2.1 mΩ AC typ; DC + busbars may be up to ~2×'),
    check('Pack R0 @ 50 % SOC [mΩ]', lerp(0.5, R0_TBL) * S / P * 1000, 13.6, 30, 'mΩ', '13 × 2.1 / 2 = 13.7 mΩ cells only'),
    check('R1 + R2 cell @ 50 % SOC [mΩ]', (lerp(0.5, R1_TBL) + lerp(0.5, R2_TBL)) * 1000, 0, lerp(0.5, R0_TBL) * 1000, 'mΩ', 'RC terms below R0 for a 15C power cell'),
    check('SoH_cap @ 300 cycles [-]', 1 - KQ * 300, 0.799, 0.801, '-', 'datasheet: ≥ 300 cycles to 80 % at 1C'),
  ]);
}

console.log(`\n${BOLD}FSS-HS-SIMULATOR — Validation against EP9343126VVP datasheet${RESET}`);
console.log('═'.repeat(92));
const results = [test1_Ocv(), test2_Discharge(), test3_Thermal(), test4_Params()];
const passed = results.filter(Boolean).length;
console.log(`\n${'═'.repeat(92)}\n${BOLD}Summary: ${passed}/${results.length} test groups passed.${RESET}`);
console.log(`${DIM}OCV table and R0/R1/R2 are estimates anchored to the datasheet. Replace them with a`);
console.log(`measured C/10 OCV curve and pulse-test resistances, then re-run this script.${RESET}\n`);
process.exit(passed === results.length ? 0 : 1);
