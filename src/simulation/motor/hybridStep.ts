/**
 * Voimansiirtoarkkitehtuuri:
 *
 * ETUAKSELI — 2× napamoottori (hub motor), suoravetoinen, ei vaihteistoa
 *   → EM-voima rajoitettu etuakselin normaalivoimalla N_f
 *   → Kiihdytyksessä paino siirtyy taakse → N_f pienenee → EM:n rajoite
 *   → Matalalla nopeudella EM on dominoiva (korkea vääntö, hyvä etupidon käyttöaste)
 *
 * TAKAAKSELI — ICE → vaihteisto → tasauspyörästö
 *   → ICE-voima rajoitettu takaakselin normaalivoimalla N_r
 *   → Kiihdytyksessä paino siirtyy taakse → N_r kasvaa → ICE hyötyy
 *   → Korkeilla nopeuksilla ICE on dominoiva
 *
 * Oskillaation esto: painonsiirto lasketaan eksponentiaalisesti suodatetulla
 * kiihtyvyydellä (α = 0.12, τ ≈ 0.4 s). Napamoottorit reagoivat sähköisesti
 * nopeasti, mutta renkaiden pito muuttuu mekaanisesti hitaasti — hidas suodatus
 * on fysikaalisesti perusteltu, ei pelkkä numeerinen kikka.
 */
import { interpICETorque, calcIceFuelStep } from './iceEngine';
import { battery2RCStep, packMaxPowerW } from '../battery';

const ALPHA_WEIGHT = 0.12;  // suodatuskerroin painonsiirrolle, τ ≈ dt/α ≈ 0.42 s

// ── Config ────────────────────────────────────────────────────────────────

export interface HybridConfig {
  // Sähkömoottori (etuakseli, 2× napamoottori, yhteisarvo)
  P_em_peak_kW: number;   // yhteinen EM-huipputeho
  P_em_cont_kW: number;   // yhteinen EM-jatkuvateho
  T_em_peak_Nm: number;   // max pyörävääntö EM:ltä (matalilla nopeuksilla)
  eta_em: number;         // ESC + käämitys hyötysuhde (sähkö→mekaniikka)
  eta_regen: number;

  // ICE (takaakseli)
  ice_gear: number;       // ICE-akseli → pyörä välityssuhde (sis. loppuvälityksen)
  bsfc_gkWh: number;      // ominaiskulutus [g/kWh]
  ice_start_delay_s: number;
  ice_rpm_min: number;    // alla tämän ICE ei voi tuottaa momenttia

  // Akku — 2RC Thevenin
  pack_series: number;
  pack_parallel: number;
  pack_Q_Ah: number;
  pack_T_celsius: number;

  // Ajoneuvo
  mass_kg: number;
  wheel_r_m: number;
  CdA_m2: number;
  Crr: number;
  mu: number;
  // Ajoneuvodynamiikka (painonsiirto)
  h_cg_m: number;         // massakeskipisteen korkeus [m]
  wheelbase_m: number;    // akseliväli [m]
  f_front: number;        // staattinen etuakselipaino-osuus [0–1]
}

// ── State ─────────────────────────────────────────────────────────────────

export interface HybridState {
  t: number;
  v_ms: number;
  x_m: number;
  soc: number;
  wh_em: number;
  wh_mech: number;
  fuel_g: number;
  boost_t: number;
  V_rc1: number;
  V_rc2: number;
  a_smooth: number;   // suodatettu kiihtyvyys painonsiirtoa varten [m/s²]
}

// ── Output point ──────────────────────────────────────────────────────────

export interface HybridPoint {
  t: number;
  v_kmh: number;
  a_ms2: number;
  x_m: number;
  P_demand_kW: number;
  P_em_kW: number;
  P_ice_kW: number;
  P_total_kW: number;
  T_em_Nm: number;
  T_ice_Nm: number;
  T_total_Nm: number;
  RPM_wheel: number;
  RPM_ice: number;
  N_f: number;        // etuakselin normaalivoima [N]
  N_r: number;        // takaakselin normaalivoima [N]
  soc: number;
  I_bat: number;
  V_bat: number;
  V_rc1: number;
  V_rc2: number;
  wh_em: number;
  fuel_g: number;
  wh_mech: number;
  eta_sys: number;
  is_hybrid: boolean;
}

// ── Step function ─────────────────────────────────────────────────────────

export function hybridStep(
  state: HybridState,
  cfg: HybridConfig,
  P_demand_override: number | null,
  dt: number,
): { state: HybridState; point: HybridPoint } {

  const v = Math.max(0.05, state.v_ms);
  const omega_wheel = v / cfg.wheel_r_m;
  const RPM_wheel = omega_wheel * 60 / (2 * Math.PI);
  const RPM_ice = Math.max(500, RPM_wheel * cfg.ice_gear);

  // ── Painonsiirto (eksponentiaalisesti suodatettu kiihtyvyys) ──────────────
  // Käytetään edellisen askeleen suodatettua kiihtyvyyttä → ei oskillaatiota
  const a_p = state.a_smooth;
  const F_grav = cfg.mass_kg * 9.81;
  const dN = cfg.mass_kg * a_p * cfg.h_cg_m / cfg.wheelbase_m;
  const N_f = Math.max(0, F_grav * cfg.f_front - dN);    // etuakseli
  const N_r = Math.max(0, F_grav * (1 - cfg.f_front) + dN); // takaakseli

  // ── Etuakselin EM-traktiorajoitus (napamoottorit, ei differentiaalia) ─────
  // Kummallekin etupyörälle puolet voimasta, mutta normaalikuorma on symmetrinen
  // → sama tulos kuin yhteinen rajoite mu * N_f
  const F_em_trac_limit = cfg.mu * N_f;

  // ── Takaakselin ICE-traktiorajoitus ──────────────────────────────────────
  const F_ice_trac_limit = cfg.mu * N_r;

  // ── Akun hetkellinen tehokapasiteetti ────────────────────────────────────
  // P_max = V_eff² / (4·R0)   (matched-impedance maksimiteho)
  const P_bat_max_W = packMaxPowerW(
    state.soc, state.V_rc1, state.V_rc2,
    cfg.pack_series, cfg.pack_parallel, cfg.pack_T_celsius,
  );
  const P_em_bat_limit_kW = P_bat_max_W * cfg.eta_em / 1000;

  // ── EM-kyky (etuakseli) ───────────────────────────────────────────────────
  // Vuoheikennusmalli: T_max(ω) = min(T_peak, P_avail/ω)
  const P_em_avail_kW = Math.min(
    state.boost_t < 5.0 ? cfg.P_em_peak_kW : cfg.P_em_cont_kW,
    P_em_bat_limit_kW,   // akkurajoite
  );
  const T_em_power_limit = P_em_avail_kW * 1000 / omega_wheel;
  const T_em_motor_limit = Math.min(cfg.T_em_peak_Nm, T_em_power_limit);
  const F_em_motor_max = T_em_motor_limit / cfg.wheel_r_m;
  const F_em_max = Math.min(F_em_motor_max, F_em_trac_limit);

  // ── ICE-kyky (takaakseli) ─────────────────────────────────────────────────
  const ice_on = state.t >= cfg.ice_start_delay_s && RPM_ice >= cfg.ice_rpm_min;
  let T_ice_shaft = 0;
  if (ice_on) T_ice_shaft = interpICETorque(RPM_ice);
  const T_ice_avail = T_ice_shaft * cfg.ice_gear * 0.97;
  const F_ice_motor_max = T_ice_avail / cfg.wheel_r_m;
  const F_ice_max = Math.min(F_ice_motor_max, F_ice_trac_limit);

  // ── Tehopyynnön laskenta ──────────────────────────────────────────────────
  const P_em_max_kW = F_em_max * v / 1000;
  const P_ice_max_kW = F_ice_max * v / 1000;
  const P_avail_kW = P_em_max_kW + P_ice_max_kW;

  const P_demand_kW = P_demand_override !== null
    ? P_demand_override / 1000
    : P_avail_kW;   // täysi kaasu

  // ── EM-ensin -strategia ───────────────────────────────────────────────────
  const F_demand = P_demand_kW > 0 ? P_demand_kW * 1000 / v : 0;
  let F_em_use: number;
  let F_ice_use: number;
  if (F_demand <= F_em_max) {
    F_em_use = Math.max(0, F_demand);
    F_ice_use = 0;
  } else {
    F_em_use = F_em_max;
    F_ice_use = Math.min(F_demand - F_em_use, F_ice_max);
  }

  const T_em_act = F_em_use * cfg.wheel_r_m;
  const T_ice_act = F_ice_use * cfg.wheel_r_m;
  const P_em_act_kW = T_em_act * omega_wheel / 1000;
  const P_ice_act_kW = T_ice_act * omega_wheel / 1000;
  const P_total_act_kW = P_em_act_kW + P_ice_act_kW;

  // ── Pitkittäisdynamiikka ──────────────────────────────────────────────────
  // F_drag = ½ · ρ · CdA · v²   (ρ = 1.225 kg/m³)
  // F_roll = Crr · m · g
  const F_traction = F_em_use + F_ice_use;
  const F_drag = 0.5 * 1.225 * cfg.CdA_m2 * v * v;
  const F_roll = cfg.Crr * cfg.mass_kg * 9.81;
  const F_net = F_traction - F_drag - F_roll;
  const a = F_net / cfg.mass_kg;

  // Suodatettu kiihtyvyys seuraavaa painonsiirtoaskelta varten
  const a_smooth_new = state.a_smooth * (1 - ALPHA_WEIGHT) + a * ALPHA_WEIGHT;

  // ── Akku — 2RC Thevenin ───────────────────────────────────────────────────
  const P_bat_W = P_em_act_kW * 1000 / Math.max(0.5, cfg.eta_em);
  const batResult = battery2RCStep(
    state.soc, state.wh_em,
    state.V_rc1, state.V_rc2,
    cfg.pack_series, cfg.pack_parallel,
    cfg.pack_Q_Ah, cfg.pack_T_celsius,
    P_bat_W, dt,
  );

  // ── ICE-polttoaine ────────────────────────────────────────────────────────
  const fuel_new = state.fuel_g + calcIceFuelStep(P_ice_act_kW * 1000, cfg.bsfc_gkWh, dt);

  // ── Boost-ajastin (yksisuuntainen salpa) ──────────────────────────────────
  const boost_t_new = P_em_act_kW >= cfg.P_em_cont_kW
    ? Math.min(5.0, state.boost_t + dt)
    : state.boost_t;

  // ── Kinematiikka ──────────────────────────────────────────────────────────
  const v_new = Math.max(0, state.v_ms + a * dt);
  const x_new = state.x_m + state.v_ms * dt + 0.5 * a * dt * dt;
  const wh_mech_new = state.wh_mech + P_total_act_kW * dt / 3.6;

  // ── Järjestelmähyötysuhde ─────────────────────────────────────────────────
  // Polttoaineteho: P_fuel [W] = P_ice [kW] × BSFC [g/kWh] × HHV [Wh/g]
  // Yksikköanalyysi: kW × g/kWh × Wh/g = Wh/h = W ✓
  const HHV_gasoline = 12.78;  // Wh/g
  const P_fuel_W = P_ice_act_kW * cfg.bsfc_gkWh * HHV_gasoline;
  const P_in_total = batResult.V_bat * batResult.I_bat + P_fuel_W;
  const eta_sys = P_in_total > 1
    ? Math.min(1, (P_total_act_kW * 1000) / P_in_total)
    : 0;

  const newState: HybridState = {
    t: state.t + dt,
    v_ms: v_new,
    x_m: x_new,
    soc: batResult.soc_new,
    wh_em: batResult.wh_new,
    wh_mech: wh_mech_new,
    fuel_g: fuel_new,
    boost_t: boost_t_new,
    V_rc1: batResult.V_rc1,
    V_rc2: batResult.V_rc2,
    a_smooth: a_smooth_new,
  };

  const point: HybridPoint = {
    t: state.t,
    v_kmh: state.v_ms * 3.6,
    a_ms2: a,
    x_m: state.x_m,
    P_demand_kW,
    P_em_kW: P_em_act_kW,
    P_ice_kW: P_ice_act_kW,
    P_total_kW: P_total_act_kW,
    T_em_Nm: T_em_act,
    T_ice_Nm: T_ice_act,
    T_total_Nm: T_em_act + T_ice_act,
    RPM_wheel,
    RPM_ice,
    N_f,
    N_r,
    soc: batResult.soc_new * 100,
    I_bat: batResult.I_bat,
    V_bat: batResult.V_bat,
    V_rc1: batResult.V_rc1,
    V_rc2: batResult.V_rc2,
    wh_em: batResult.wh_new,
    fuel_g: fuel_new,
    wh_mech: wh_mech_new,
    eta_sys: eta_sys * 100,
    is_hybrid: P_ice_act_kW > 0.1,
  };

  return { state: newState, point };
}
