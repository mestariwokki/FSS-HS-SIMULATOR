// Compare the legal 13S cell configurations from EP_Battery_configurations.xlsx
// with the recommended VESC setup (gear 3.0, 120 A, motor limit 115–130 °C)
// and the HSF baseline (86 A, 85–100 °C).  node scripts/cell-configs.mjs
// Other EP cells are scaled from the EP9343126VVP model: R ∝ 1/Ah (same
// chemistry and construction), heat capacity from mass, same HSC v2 cooling.
// 1P packs with a big cell are modelled as 2P of half-cells (same physics).
import { createServer } from 'vite';
const s = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const H = await s.ssrLoadModule('/src/simulation/endurance/hscEndurance.ts');
const cm = await s.ssrLoadModule('/src/simulation/cellModel.ts');
const th = await s.ssrLoadModule('/src/simulation/hscThermal.ts');
const T_ACC_MIN = 3.6, T_AX_MIN = 60, T_END_MIN = 1300;
const accPts = t => 3.5 + 46.5 * (1.5 * T_ACC_MIN / t - 1) / 0.5;
const axPts = t => 4.5 + 95.5 * (1.45 * T_AX_MIN / t - 1) / 0.45;
const endPts = t => 25 + 225 * (1.333 * T_END_MIN / t - 1) / 0.333;
// datasheet values from the team sheet: Ah, mass g, I_cont, I_peak (per cell)
const CELLS = {
  EP8543126VVP: [6.2, 95, 93, 155], EP9343126VVP: [6.6, 102, 99, 165], EP9543126VVP: [6.8, 105, 102, 170],
  EP7560129VVP: [8, 123, 96, 160], EP7065170VVP: [10, 157, 120, 200],
};
const CONFIGS = [['EP9343126VVP', 2], ['EP8543126VVP', 2], ['EP9543126VVP', 2], ['EP7065170VVP', 1], ['EP7560129VVP', 1], ['EP9343126VVP', 1]];
const base = cm.EP9343126VVP_MODEL;
function packFor(name, P) {
  const [Ah, g, Ic, Ip] = CELLS[name];
  const split = P === 1 && Ah > 7 ? 2 : 1;            // model a big 1P cell as 2 half-cells
  const q = Ah / split, k = base.Q_Ah / q;
  const cell = { ...base, Q_Ah: q, mass_kg: g / 1000 / split, R0_ref_Ohm: base.R0_ref_Ohm * k, R1_ref_Ohm: base.R1_ref_Ohm * k, R2_ref_Ohm: base.R2_ref_Ohm * k };
  const pack = { ...cm.defaultPackModel(13, P * split), cell };
  return { pack, I_cont: Ic * P, I_peak: Ip * P, I_chg: 4 * Ah * P, mass_g: 13 * P * g, Wh: 13 * P * Ah * 3.9 };
}
const C = th.HSC_CONCEPTS.V2;
const SETUPS = { recommended: { g: 3.0, I: 120, Tl: [115, 130] }, baseline: { g: 3.0, I: 86, Tl: [85, 100] } };
for (const [name, P] of CONFIGS) {
  const p = packFor(name, P);
  const legal = p.mass_g <= 3000;
  const line = [];
  for (const [sn, su] of Object.entries(SETUPS)) {
    const b = H.defaultVehicle();
    const veh = { ...b, mass_kg: b.mass_kg + 1.3 + (p.mass_g - 2652) / 1000,
      em: { ...b.em, gear: su.g, T_motor_max_Nm: 99, I_motor_max_A: su.I, I_esc_cont_A: su.I, I_esc_peak_A: su.I, T_motor_derate_C: su.Tl } };
    // the HSC current is capped at the cells' continuous rating (peak only 3 s)
    const st = { ...H.defaultStrategy(), I_dis_limit_A: Math.min(198, p.I_cont), I_chg_limit_A: Math.min(52.8, p.I_chg) };
    const a = H.runAcceleration(veh, st, p.pack, 0.95, 30, C);
    const ax = H.runHscEndurance(veh, st, p.pack, { ...H.defaultSetup(C), n_laps: 1, laps_before_change: 99 });
    const e = H.runHscEndurance(veh, st, p.pack, H.defaultSetup(C));
    const pts = accPts(a.t75_s) + axPts(ax.total_time_s) + endPts(e.total_time_s);
    line.push(`${sn}: pts ${pts.toFixed(2)} t75 ${a.t75_s.toFixed(3)} end ${e.total_time_s.toFixed(1)} k ${e.k.toFixed(2)} soc ${(e.soc_end * 100).toFixed(0)}% Ts ${e.T_sensor_max_C.toFixed(1)} Vmin ${e.V_cell_min.toFixed(2)} trip ${e.bms_trip ?? a.bms_trip ?? '-'}`);
  }
  console.log(`13S${P}P ${name}: cells ${p.mass_g} g ${legal ? 'OK' : '> 3 kg'} | ${p.Wh.toFixed(0)} Wh | I ${p.I_cont}/${p.I_peak} A\n   ${line.join('\n   ')}`);
}
await s.close();
