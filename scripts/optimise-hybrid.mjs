// Design-space search + Monte Carlo robustness for the hybrid configuration.
//   node scripts/optimise-hybrid.mjs [N_mc=150]
// Decision variables: hub gear ratio, VESC motor-current limit for endurance,
// VESC motor-temperature limit window (endurance), VESC current for the short
// events (acceleration + autocross profile). HSC = HSC v2 rev0.2.
// Score = FS points from acceleration (50), autocross (100) and endurance (250)
// with assumed winner times; only differences between configurations matter.
// ESC cooling uncertainty = VESC_FSO R2 passive heat-sink options 1–4 (0.28–0.59 W/K).
import { createServer } from 'vite';
const s = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const H = await s.ssrLoadModule('/src/simulation/endurance/hscEndurance.ts');
const cm = await s.ssrLoadModule('/src/simulation/cellModel.ts');
const th = await s.ssrLoadModule('/src/simulation/hscThermal.ts');
const N_MC = Number(process.argv[2] ?? 150);

// ── scoring (FS rules D-chapter form; winner times are assumptions) ──
const T_ACC_MIN = 3.6, T_AX_MIN = 60, T_END_MIN = 1300;
const accPts = t => { const tm = 1.5 * T_ACC_MIN; return t >= tm ? 3.5 : 3.5 + 46.5 * (tm / t - 1) / (tm / T_ACC_MIN - 1); };
const axPts = t => { const tm = 1.45 * T_AX_MIN; return t >= tm ? 4.5 : 4.5 + 95.5 * (tm / t - 1) / (tm / T_AX_MIN - 1); };
const endPts = t => { const tm = 1.333 * T_END_MIN; return t >= tm ? 25 : 25 + 225 * (tm / t - 1) / (tm / T_END_MIN - 1); };

const GEARS = [2.5, 2.75, 3.0, 3.25, 3.5, 3.75, 4.0];
const I_END = [60, 70, 85, 100, 120];
const T_LIM = [[85, 100], [100, 115], [115, 130], [130, 145]];
const I_SHORT = [85, 100, 120];
const BASE = { g: 3.0, Ie: 86, Tl: [85, 100], Is: 86 };   // HSF 2026 / VESC defaults

const nominal = () => ({ Gc: 1, Rwc: 1, Rm: 1, ksat: 0.5, I0: 1, Resc: 1, Gesc: 1, UA: 1, Rcell: 1, Tamb: 30 });
function sample(rng) {
  const u = (a, b) => a + (b - a) * rng();
  return { Gc: u(0.5, 1.5), Rwc: u(0.7, 1.5), Rm: u(0.9, 1.1), ksat: u(0.3, 0.7), I0: u(0.7, 2.0),
    Resc: u(0.7, 1.4), Gesc: u(0.56, 1.18), UA: u(0.6, 1.4), Rcell: u(0.9, 1.3), Tamb: u(20, 35) };
}
function vehicle(unc, g, I, Tl) {
  const b = H.defaultVehicle();
  const em = { ...b.em, gear: g, T_motor_max_Nm: 99, I_motor_max_A: I, I_esc_cont_A: I, I_esc_peak_A: I,
    k_sat: unc.ksat, R_w_Ohm: b.em.R_w_Ohm * unc.Rm, I0_A: b.em.I0_A * unc.I0, R_esc_Ohm: b.em.R_esc_Ohm * unc.Resc,
    G_esc_amb_WK: b.em.G_esc_amb_WK * unc.Gesc, G_case_amb0_WK: b.em.G_case_amb0_WK * unc.Gc,
    G_case_amb_kv: b.em.G_case_amb_kv * unc.Gc, R_wind_case_KW: b.em.R_wind_case_KW * unc.Rwc,
    T_motor_derate_C: Tl };
  return { ...b, mass_kg: b.mass_kg + 1.3, em };
}
const conceptOf = unc => { const c = th.HSC_CONCEPTS.V2; return { ...c, UA_hot_struct_WK: c.UA_hot_struct_WK * unc.UA, UA_cells_struct_WK: c.UA_cells_struct_WK * unc.UA, UA_fan_WK: c.UA_fan_WK * unc.UA, UA_amb0_WK: c.UA_amb0_WK * unc.UA }; };
const packOf = unc => ({ ...cm.defaultPackModel(), soh_res: unc.Rcell });
const strat = H.defaultStrategy();
const vUnc = (g, V) => 104 * V / g * 2 * Math.PI / 60 * 0.206 * 3.6;   // km/h where back-EMF = V
const V_FULL = 56.7;

function short(unc, g, Is) {
  const veh = vehicle(unc, g, Is, [85, 100]); const pack = packOf(unc); const c = conceptOf(unc);
  const a = H.runAcceleration(veh, strat, pack, 0.95, unc.Tamb, c);
  const ax = H.runHscEndurance(veh, strat, pack, { ...H.defaultSetup(c), n_laps: 1, laps_before_change: 99, T_amb_C: unc.Tamb, T0_C: unc.Tamb });
  const vend = a.trace.at(-1).v_kmh;
  const ok = !a.bms_trip && !ax.bms_trip && vUnc(g, V_FULL) > vend + 5;
  return { t75: a.t75_s, tax: ax.total_time_s, ok, pts: accPts(a.t75_s) + axPts(ax.total_time_s), Tm: ax.T_motor_max_C };
}
function endurance(unc, g, Ie, Tl) {
  const veh = vehicle(unc, g, Ie, Tl); const pack = packOf(unc); const c = conceptOf(unc);
  const r = H.runHscEndurance(veh, strat, pack, { ...H.defaultSetup(c), T_amb_C: unc.Tamb, T0_C: unc.Tamb });
  const Vend = cm.evalPack(cm.initPackState(r.soc_end), pack, 0, 25).V_esc;
  const vmax = Math.max(...r.lap_speed.map(p => p.v_kmh));
  const ok = !r.bms_trip && r.T_motor_max_C < 160 && vUnc(g, Vend) > vmax + 5;
  return { t: r.total_time_s, ok, pts: endPts(r.total_time_s), Tm: r.T_motor_max_C, Ts: r.T_sensor_max_C, soc: r.soc_end, Irms: r.I_rms_drive_A, der: r.em_derate_time_s, Tesc: r.T_esc_max_C, k: r.k, vmax, vu: vUnc(g, Vend) };
}

// ── stage 1: nominal grid ──
const nom = nominal();
const iceOnly = (() => { const veh = vehicle(nom, 3, 0.001, [85, 100]); const pack = packOf(nom); const c = conceptOf(nom);
  const e = H.runHscEndurance(veh, { ...strat, deploy: 'manual', k_manual: 0 }, pack, { ...H.defaultSetup(c) });
  const a = H.runAcceleration(veh, strat, pack, 0.95, 30, c, false);
  const ax = H.runHscEndurance(veh, { ...strat, deploy: 'manual', k_manual: 0 }, pack, { ...H.defaultSetup(c), n_laps: 1, laps_before_change: 99 });
  return { pts: accPts(a.t75_s) + axPts(ax.total_time_s) + endPts(e.total_time_s), t75: a.t75_s, tax: ax.total_time_s, tend: e.total_time_s }; })();
console.log('ICE only', JSON.stringify(iceOnly));
const shortRes = {}, endRes = {};
for (const g of GEARS) {
  for (const Is of [86, ...I_SHORT]) shortRes[`${g}|${Is}`] = short(nom, g, Is);
  for (const Ie of [86, ...I_END]) for (const Tl of T_LIM) endRes[`${g}|${Ie}|${Tl}`] = endurance(nom, g, Ie, Tl);
}
const configs = [];
for (const g of GEARS) for (const Is of [86, ...I_SHORT]) for (const Ie of [86, ...I_END]) for (const Tl of T_LIM) {
  const a = shortRes[`${g}|${Is}`], e = endRes[`${g}|${Ie}|${Tl}`];
  configs.push({ g, Is, Ie, Tl, ok: a.ok && e.ok, pts: a.pts + e.pts, a, e });
}
const key = c => `${c.g}|${c.Is}|${c.Ie}|${c.Tl}`;
const base = configs.find(c => key(c) === key(BASE));
const fmt = c => `g ${c.g} short ${c.Is}A end ${c.Ie}A Tlim ${c.Tl.join('-')} | ${c.ok ? 'OK ' : 'NOK'} pts ${(c.pts - iceOnly.pts).toFixed(2)} | t75 ${c.a.t75.toFixed(3)} ax ${c.a.tax.toFixed(2)} end ${c.e.t.toFixed(1)} | Tm ${c.e.Tm.toFixed(0)} Ts ${c.e.Ts.toFixed(1)} Tesc ${c.e.Tesc.toFixed(0)} soc ${(c.e.soc * 100).toFixed(0)} Irms ${c.e.Irms.toFixed(0)} der ${c.e.der.toFixed(0)} k ${c.e.k.toFixed(2)} vmax ${c.e.vmax.toFixed(0)}/${c.e.vu.toFixed(0)}`;
console.log('BASELINE', fmt(base));
const okc = configs.filter(c => c.ok).sort((x, y) => y.pts - x.pts);
console.log(`\nfeasible ${okc.length}/${configs.length}; top 15:`);
okc.slice(0, 15).forEach(c => console.log(fmt(c)));
console.log('\nbest per gear:');
for (const g of GEARS) { const b = okc.find(c => c.g === g); if (b) console.log(fmt(b)); else console.log('g', g, 'no feasible'); }
console.log('\ninfeasible reasons (gear ≥ 3.5):');
for (const g of [3.5, 3.75, 4.0]) { const c = configs.find(x => x.g === g && x.Is === 120 && x.Ie === 85 && x.Tl[0] === 130); console.log(fmt(c), 'short ok', c.a.ok, 'end ok', c.e.ok); }

// ── stage 2: Monte Carlo on the candidates ──
if (N_MC > 0) {
  const pick = [];
  const seen = new Set();
  const add = c => { if (c && !seen.has(key(c))) { seen.add(key(c)); pick.push(c); } };
  okc.slice(0, 8).forEach(add);
  for (const g of GEARS) add(okc.find(c => c.g === g));
  add(base);
  add(okc.find(c => c.Tl[0] === 85));          // best with default VESC temp limits
  add(okc.find(c => c.Is <= 86 && c.Ie <= 86)); // best within HSF currents
  let seed = 12345; const rng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const wins = new Map(pick.map(c => [key(c), 0]));
  const stats = new Map(pick.map(c => [key(c), { d: [], nok: 0, Tm: [] }]));
  for (let n = 0; n < N_MC; n++) {
    const unc = sample(rng);
    const sc = new Map(), ec = new Map();
    const res = pick.map(c => {
      const ks = `${c.g}|${c.Is}`, ke = `${c.g}|${c.Ie}|${c.Tl}`;
      if (!sc.has(ks)) sc.set(ks, short(unc, c.g, c.Is));
      if (!ec.has(ke)) ec.set(ke, endurance(unc, c.g, c.Ie, c.Tl));
      const a = sc.get(ks), e = ec.get(ke);
      return { c, ok: a.ok && e.ok, pts: a.pts + e.pts, Tm: e.Tm };
    });
    const b = res.find(r => key(r.c) === key(base));
    const ok = res.filter(r => r.ok).sort((x, y) => y.pts - x.pts);
    if (ok[0]) wins.set(key(ok[0].c), wins.get(key(ok[0].c)) + 1);
    for (const r of res) { const st = stats.get(key(r.c)); st.d.push(r.pts - b.pts); st.Tm.push(r.Tm); if (!r.ok) st.nok++; }
    if ((n + 1) % 25 === 0) console.error('mc', n + 1);
  }
  const pct = (a, p) => { const x = [...a].sort((u, v) => u - v); return x[Math.min(x.length - 1, Math.floor(p * x.length))]; };
  console.log(`\nMonte Carlo N=${N_MC} (points vs baseline g3/86A/86A/85-100): P(best), mean, P10, P90, P(gain>0), infeasible, motor T P90`);
  for (const c of pick) {
    const st = stats.get(key(c)); const m = st.d.reduce((u, v) => u + v, 0) / st.d.length;
    console.log(`g ${c.g} short ${c.Is} end ${c.Ie} Tlim ${c.Tl.join('-')}: best ${(100 * wins.get(key(c)) / N_MC).toFixed(0)}% mean ${m.toFixed(2)} P10 ${pct(st.d, 0.1).toFixed(2)} P90 ${pct(st.d, 0.9).toFixed(2)} P>0 ${(100 * st.d.filter(x => x > 0).length / N_MC).toFixed(0)}% NOK ${st.nok} TmP90 ${pct(st.Tm, 0.9).toFixed(0)}`);
  }
}
await s.close();
