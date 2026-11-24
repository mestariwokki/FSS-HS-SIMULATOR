/**
 * Fit model parameters to test data (docs/calibration.md).
 *
 *   node scripts/fit.mjs ocv <discharge.csv> [charge.csv]
 *   node scripts/fit.mjs hppc 0=<hppc_0C.csv> 25=<hppc_25C.csv> 45=<hppc_45C.csv> [--capacity 6.6] [--threshold 5]
 *   node scripts/fit.mjs thermal <stack.csv> [--parallel 2] [--rcell 0.003] [--col t_center] [--amb t_amb]
 *
 * Common flags: --flip (logger records discharge current as negative),
 *               --out <file.json> (default fit-results.json)
 * Uses Vite's module loader to run the TypeScript fitting code directly.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'vite';

const args = process.argv.slice(2);
const flag = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const has = name => args.includes(`--${name}`);
const positional = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--') && !['--flip'].includes(args[i - 1])));
const [cmd, ...files] = positional;

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const fit = await server.ssrLoadModule('/src/calibration/fitCell.ts');
  const load = f => fit.readCsv(readFileSync(f, 'utf8'), has('flip'));
  const fmt = (a, d = 4) => `[${a.map(x => x.toFixed(d)).join(', ')}]`;
  let result;

  if (cmd === 'ocv') {
    result = fit.fitOcv(load(files[0]), files[1] ? load(files[1]) : undefined);
    console.log(`Capacity ${result.capacity_Ah.toFixed(3)} Ah (${result.method})`);
    console.log('\nPaste into src/simulation/cellData.ts:');
    console.log(`export const OCV_CELL_V  = ${fmt(result.ocv, 3)};`);
  } else if (cmd === 'hppc') {
    const cap = parseFloat(flag('capacity', '6.6'));
    const thr = parseFloat(flag('threshold', '5'));
    const perT = files.map(spec => {
      const [T, f] = spec.split('=');
      const fits = fit.fitHppc(load(f), cap, thr);
      return { T_C: parseFloat(T), fits, summary: fit.summariseHppc(fits) };
    });
    for (const p of perT) {
      console.log(`\n${p.T_C} °C: ${p.fits.length} pulses`);
      for (const f of p.fits) {
        console.log(`  SOC ${(f.soc * 100).toFixed(0).padStart(3)} %  R0 ${(f.R0 * 1e3).toFixed(2)} mΩ  R1 ${(f.R1 * 1e3).toFixed(2)} mΩ τ1 ${f.tau1} s  R2 ${(f.R2 * 1e3).toFixed(2)} mΩ τ2 ${f.tau2} s  fit ${f.rmse_mV.toFixed(2)} mV`);
      }
    }
    const ref = perT.find(p => p.T_C === 25) ?? perT[0];
    const ea = k => perT.length >= 2 ? fit.fitArrhenius(perT.map(p => ({ T_C: p.T_C, R: p.summary[k] }))).Ea : NaN;
    const s = ref.summary;
    result = { perT, model: { ...s, Ea_R0: ea('R0_ref_Ohm'), Ea_R1: ea('R1_ref_Ohm'), Ea_R2: ea('R2_ref_Ohm') } };
    const m = result.model;
    console.log('\nPaste into EP9343126VVP_MODEL in src/simulation/cellModel.ts:');
    console.log(`  R0_ref_Ohm: ${m.R0_ref_Ohm.toExponential(3)},\n  R1_ref_Ohm: ${m.R1_ref_Ohm.toExponential(3)},\n  tau1_s: ${m.tau1_s},\n  R2_ref_Ohm: ${m.R2_ref_Ohm.toExponential(3)},\n  tau2_s: ${m.tau2_s},`);
    if (perT.length >= 2) console.log(`  Ea_R0: ${m.Ea_R0.toFixed(0)},\n  Ea_R1: ${m.Ea_R1.toFixed(0)},\n  Ea_R2: ${m.Ea_R2.toFixed(0)},`);
    console.log(`  r_soc_pts: ${fmt(m.r_soc_pts, 2)},\n  r0_soc_fac: ${fmt(m.r0_soc_fac, 3)},\n  r2_soc_fac: ${fmt(m.r2_soc_fac, 3)},`);
  } else if (cmd === 'thermal') {
    const s = load(files[0]);
    const col = flag('col');
    const T = col ? s.extra[col.toLowerCase()] : s.T;
    const ambCol = flag('amb');
    const amb = ambCol ? s.extra[ambCol.toLowerCase()] : parseFloat(flag('tamb', String(T[0])));
    if (!T) throw new Error(`column ${col} not found; columns: ${Object.keys(s.extra).join(', ')}`);
    result = fit.fitStackThermal(s.t, s.I, T, amb, parseInt(flag('parallel', '2')), parseFloat(flag('rcell', '0.003')));
    console.log(`Per-cell C ${result.C_JK.toFixed(0)} J/K, UA ${result.UA_WK.toFixed(3)} W/K, τ ${result.tau_s.toFixed(0)} s, fit ${result.rmse_K.toFixed(2)} K`);
    console.log('For a centre cell: UA × (cells in the hot node) ≈ UA_hot_struct_WK + UA_hot_cells_WK in hscThermal.ts.');
  } else {
    console.log(readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(0, 13).join('\n'));
    process.exitCode = 1;
  }
  if (result) {
    const out = flag('out', 'fit-results.json');
    writeFileSync(out, JSON.stringify(result, null, 2));
    console.log(`\nSaved ${out}`);
  }
} finally {
  await server.close();
}
