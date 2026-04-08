import { hybridStep, type HybridConfig, type HybridPoint, type HybridState } from './hybridStep';

export type HybridSimMode = 'acc100' | 'acc75' | 'cruise' | 'duration';

export interface HybridSimInput extends HybridConfig {
  mode: HybridSimMode;
  soc0_pct: number;
  duration_s: number;       // used in 'duration' and 'cruise' modes
  cruise_speed_kmh: number; // used in 'cruise' mode
}

export interface HybridSummary {
  t100_s: number | null;       // 0–100 km/h time
  t75m_s: number | null;       // 0–75 m time (FS acceleration event)
  peak_power_kW: number;
  peak_a_ms2: number;
  em_only_pct: number;         // % of time running on EM alone
  hybrid_pct: number;          // % of time both motors active
  wh_em_total: number;         // Wh from battery
  fuel_g_total: number;
  fuel_ml_total: number;       // fuel_g / density_gasoline (0.74 g/ml)
  eta_sys_avg_pct: number;
  distance_m: number;
}

export function runHybridSim(inp: HybridSimInput): {
  data: HybridPoint[];
  summary: HybridSummary;
} {
  const DT = 0.05;  // s — fine enough for dynamics

  const state: HybridState = {
    t: 0,
    v_ms: 0.1,   // small initial velocity to avoid /0
    x_m: 0,
    soc: Math.max(0.05, Math.min(1, inp.soc0_pct / 100)),
    wh_em: 0,
    wh_mech: 0,
    fuel_g: 0,
    boost_t: 0,
    V_rc1: 0,
    V_rc2: 0,
    a_smooth: 0,
  };

  const data: HybridPoint[] = [];
  let st = { ...state };
  let t100: number | null = null;
  let t75m: number | null = null;
  let hybrid_steps = 0;
  let em_only_steps = 0;
  let total_steps = 0;
  let eta_sum = 0;
  let eta_n = 0;

  const maxT = (inp.mode === 'acc100' || inp.mode === 'acc75') ? 60 : inp.duration_s;
  const v_cruise = inp.cruise_speed_kmh / 3.6;

  while (st.t < maxT && st.soc > 0.01) {
    let P_demand: number | null = null;  // null = full throttle

    if (inp.mode === 'cruise') {
      const v = Math.max(0.1, st.v_ms);
      const F_drag = 0.5 * 1.225 * inp.CdA_m2 * v * v;
      const F_roll = inp.Crr * inp.mass_kg * 9.81;
      P_demand = (F_drag + F_roll) * v;

      if (st.v_ms < v_cruise * 0.98) {
        P_demand = null;  // full throttle to reach cruise speed
      }
    }

    const x_before = st.x_m;
    const v_before = st.v_ms;
    const t_before = st.t;

    const { state: ns, point } = hybridStep(st, inp, P_demand, DT);
    data.push(point);
    st = ns;

    total_steps++;
    if (point.is_hybrid) hybrid_steps++;
    else if (point.P_em_kW > 0.01) em_only_steps++;
    if (point.eta_sys > 0) { eta_sum += point.eta_sys; eta_n++; }

    if (t100 === null && st.v_ms >= 100 / 3.6) {
      // Interpoloi tarkka ylityspiste
      const frac = (100 / 3.6 - v_before) / (st.v_ms - v_before);
      t100 = t_before + frac * DT;
    }

    if (t75m === null && st.x_m >= 75) {
      // Interpoloi tarkka ylityspiste
      const frac = (75 - x_before) / (st.x_m - x_before);
      t75m = t_before + frac * DT;
    }

    if (inp.mode === 'acc100' && t100 !== null) break;
    if (inp.mode === 'acc75' && t75m !== null) break;
    if (inp.mode === 'cruise' && st.t >= inp.duration_s) break;
  }

  // Ensure at least one point
  if (data.length === 0) {
    data.push({
      t: 0, v_kmh: 0, a_ms2: 0, x_m: 0,
      P_demand_kW: 0, P_em_kW: 0, P_ice_kW: 0, P_total_kW: 0,
      T_em_Nm: 0, T_ice_Nm: 0, T_total_Nm: 0,
      RPM_wheel: 0, RPM_ice: 0, N_f: 0, N_r: 0,
      soc: inp.soc0_pct, I_bat: 0, V_bat: 0, V_rc1: 0, V_rc2: 0,
      wh_em: 0, fuel_g: 0, wh_mech: 0,
      eta_sys: 0, is_hybrid: false,
    });
  }

  const lastPt = data[data.length - 1];
  const peak_power_kW = Math.max(...data.map(d => d.P_total_kW));
  const peak_a_ms2 = Math.max(...data.map(d => d.a_ms2));

  const summary: HybridSummary = {
    t100_s: t100,
    t75m_s: t75m,
    peak_power_kW,
    peak_a_ms2,
    em_only_pct: total_steps > 0 ? (em_only_steps / total_steps) * 100 : 0,
    hybrid_pct: total_steps > 0 ? (hybrid_steps / total_steps) * 100 : 0,
    wh_em_total: lastPt.wh_em,
    fuel_g_total: lastPt.fuel_g,
    fuel_ml_total: lastPt.fuel_g / 0.74,
    eta_sys_avg_pct: eta_n > 0 ? eta_sum / eta_n : 0,
    distance_m: lastPt.x_m,
  };

  return { data, summary };
}
