// Gear-ratio sweep for the hub motors: node scripts/gear-sweep.mjs 2.5 3 3.5 4
// Prints back-EMF vs speed at the current gear, then per gear the 75 m time and the endurance result (concept A, 30 °C).
import { createServer } from 'vite';
const s = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const H = await s.ssrLoadModule('/src/simulation/endurance/hscEndurance.ts');
const cm = await s.ssrLoadModule('/src/simulation/cellModel.ts');
const th = await s.ssrLoadModule('/src/simulation/hscThermal.ts');
const { FSG_LIKE_LAP } = await s.ssrLoadModule('/src/simulation/endurance/track.ts');
const pack = cm.defaultPackModel();
const base = H.defaultVehicle();
const strat = H.defaultStrategy();
const r = base.wheel_r_m, kV = base.em.kV;
const vb = (v, g) => v / r * g * 60 / (2 * Math.PI) / kV;
console.log('speed table (gear', base.em.gear, ')');
for (const k of [20, 40, 60, 80, 100, 120, 140]) console.log(k, 'km/h ->', vb(k/3.6, 3).toFixed(1), 'V');
const ice = H.runAcceleration(base, strat, pack, 0.95, 25, th.HSC_CONCEPTS.A, false);
console.log('ICE only t75', ice.t75_s.toFixed(3));
const prof = H.lapProfile(base, strat, FSG_LIKE_LAP, 1, 0, 52, 15);
console.log('endurance vmax km/h', (Math.max(...prof.map(p=>p.v))*3.6).toFixed(1));
const gears = process.argv.slice(2).map(Number);
for (const g of gears) {
  const veh = { ...base, em: { ...base.em, gear: g } };
  const a = H.runAcceleration(veh, strat, pack, 0.95, 25, th.HSC_CONCEPTS.A);
  const e = H.runHscEndurance(veh, strat, pack, H.defaultSetup(th.HSC_CONCEPTS.A));
  const e0 = H.runHscEndurance(veh, { ...strat, deploy: 'manual', k_manual: 0 }, pack, H.defaultSetup(th.HSC_CONCEPTS.A));
  const vend = a.trace.at(-1).v_kmh;
  console.log(JSON.stringify({ g, t75: +a.t75_s.toFixed(3), vend: +vend.toFixed(1), Vb_end: +vb(vend/3.6, g).toFixed(1), Ipk: +a.I_peak_A.toFixed(0), Iph: +a.I_phase_peak_A.toFixed(0), v_nl54: +(54*kV/g*2*Math.PI/60*r*3.6).toFixed(0), k: +e.k.toFixed(2), gain_s: +(e0.total_time_s - e.total_time_s).toFixed(1), Irms: +e.I_rms_drive_A.toFixed(0), Ts: +e.T_sensor_max_C.toFixed(1), Tm: +e.T_motor_max_C.toFixed(0), soc: +e.soc_end.toFixed(2), trip: e.bms_trip }));
}
await s.close();
