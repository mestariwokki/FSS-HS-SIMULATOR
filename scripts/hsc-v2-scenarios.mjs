// HSC v2 rev0.2 + VESC_FSO + Neumotors scenarios: node scripts/hsc-v2-scenarios.mjs
// Car mass +1.3 kg for the 5.8 kg HSC (HSF 2026: 4.5 kg). "120A" = motor and VESC allowed 120 A (VESC_FSO design report).
import { createServer } from 'vite';
const s = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const H = await s.ssrLoadModule('/src/simulation/endurance/hscEndurance.ts');
const cm = await s.ssrLoadModule('/src/simulation/cellModel.ts');
const th = await s.ssrLoadModule('/src/simulation/hscThermal.ts');
const mc = await s.ssrLoadModule('/src/simulation/motor/motorConstants.ts');
const V2 = th.HSC_CONCEPTS.V2;
const base = { ...H.defaultVehicle(), mass_kg: 285 + 1.3 };
const pack = cm.defaultPackModel(); const st = H.defaultStrategy();
const Kt = mc.kVtoKt(104);
const em120 = { ...base.em, T_motor_max_Nm: 120 * Kt, I_motor_max_A: 120, I_esc_peak_A: 120, I_esc_cont_A: 120 };
const emSat = { ...base.em, T_motor_max_Nm: 85 * Kt };                       // datasheet 85 A saturation, VESC 86/100 A
const emV60 = { ...emSat, I_esc_cont_A: 60, I_esc_peak_A: 60 };              // VESC limited to 60 A
const emWarm = { ...emSat, T_motor_derate_C: [130, 150] };                   // motor limit raised (winding max 180 °C)
const fanOff = { ...V2, UA_fan_WK: 0 };
const ice = H.runHscEndurance(base, { ...st, deploy: 'manual', k_manual: 0 }, pack, H.defaultSetup(V2));
const f = (n, r, ref = ice) => console.log(n.padEnd(28), `k ${r.k.toFixed(2)} Irms ${r.I_rms_drive_A.toFixed(0)} Ipk ${r.I_peak_A.toFixed(0)} Ts ${r.T_sensor_max_C.toFixed(1)} Tcore ${r.T_hot_max_C.toFixed(1)} Tstr ${r.T_struct_max_C.toFixed(1)} soc ${(r.soc_end*100).toFixed(0)} Vmin ${r.V_cell_min.toFixed(2)} gain ${(ref.total_time_s - r.total_time_s).toFixed(1)}s Tm ${r.T_motor_max_C.toFixed(0)} Tesc ${r.T_esc_max_C.toFixed(0)} der ${r.em_derate_time_s.toFixed(0)} Iph ${r.I_phase_peak_A.toFixed(0)} eta ${(r.eta_drive_avg*100).toFixed(1)}/${(r.eta_regen_avg*100).toFixed(1)} Qc ${r.Q_cells_avg_W.toFixed(0)}W trip ${r.bms_trip} ${r.bms_trip_lap ?? ''}`);
console.log('ICE-only total', ice.total_time_s.toFixed(1), 's, laps', ice.lap_times_s.length);
const S = (o = {}) => ({ ...H.defaultSetup(V2), ...o });
f('V2 auto 30C', H.runHscEndurance(base, st, pack, S()));
f('V2 auto 35C', H.runHscEndurance(base, st, pack, S({ T_amb_C: 35, T0_C: 35 })));
f('V2 auto 25C', H.runHscEndurance(base, st, pack, S({ T_amb_C: 25, T0_C: 25 })));
f('V2 fan failure 30C', H.runHscEndurance(base, st, pack, { ...S(), concept: fanOff }));
f('V2 R_hsc 2.0 mOhm', H.runHscEndurance(base, st, { ...pack, R_hsc_internal_Ohm: 0.002 }, S()));
f('V2 gear 3.5', H.runHscEndurance({ ...base, em: { ...base.em, gear: 3.5 } }, st, pack, S()));
f('V2 motor 85A sat', H.runHscEndurance({ ...base, em: emSat }, st, pack, S()));
f('V2 motor 85A, derate 130-150', H.runHscEndurance({ ...base, em: emWarm }, st, pack, S()));
f('V2 VESC 60A', H.runHscEndurance({ ...base, em: emV60 }, st, pack, S()));
f('V2 motor+VESC 120A', H.runHscEndurance({ ...base, em: em120 }, st, pack, S()));
f('V2 120A 35C', H.runHscEndurance({ ...base, em: em120 }, st, pack, S({ T_amb_C: 35, T0_C: 35 })));
f('A (ref) auto 30C', H.runHscEndurance(base, st, pack, H.defaultSetup(th.HSC_CONCEPTS.A)));
const acc = (n, veh, soc = 0.95, T = 25) => { const a = H.runAcceleration(veh, st, pack, soc, T, V2); console.log(n.padEnd(28), `t75 ${a.t75_s.toFixed(3)} ice ${a.t75_ice_only_s.toFixed(3)} Ipk ${a.I_peak_A.toFixed(0)} Iph ${a.I_phase_peak_A.toFixed(0)} Vmin ${a.V_cell_min.toFixed(2)} vend ${a.trace.at(-1).v_kmh.toFixed(0)} trip ${a.bms_trip}`); };
acc('acc 95% 25C', base); acc('acc 30% 5C', base, 0.3, 5); acc('acc gear 3.5', { ...base, em: { ...base.em, gear: 3.5 } }); acc('acc 85A sat', { ...base, em: emSat }); acc('acc VESC 60A', { ...base, em: emV60 }); acc('acc 120A', { ...base, em: em120 }); acc('acc 120A gear3.5', { ...base, em: { ...em120, gear: 3.5 } });
await s.close();
