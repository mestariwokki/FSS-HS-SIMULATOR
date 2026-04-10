import { useState, useEffect, useCallback, useMemo } from 'react';
import { runHybridSim, type HybridSimMode, type HybridSummary } from '../../simulation/motor/runHybridSim';
import type { HybridPoint } from '../../simulation/motor/hybridStep';
import { LineChart } from '../charts/LineChart';
import { HybridBldcMap } from '../charts/HybridBldcMap';
import { HybridIceMap } from '../charts/HybridIceMap';
import { ParamGroup } from '../common/ParamGroup';
import { ICE_TORQUE_CURVE } from '../../simulation/motor/iceEngine';

// ── Section header ────────────────────────────────────────────────────────
function SHead({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: '10px', color: '#4fc3f7', textTransform: 'uppercase',
      letterSpacing: '2px', borderBottom: '1px solid #1e3a4a',
      paddingBottom: '3px', marginTop: '12px', marginBottom: '8px',
    }}>
      {children}
    </div>
  );
}

// ── Summary card ──────────────────────────────────────────────────────────
function SCard({
  label, value, unit, color = '#ddd', sub,
}: {
  label: string; value: string; unit: string; color?: string; sub?: string;
}) {
  return (
    <div style={{
      background: '#131318', border: '1px solid #2a2a3a', borderRadius: '3px',
      padding: '10px 16px', minWidth: '120px', flex: '1 1 120px',
    }}>
      <div style={{ fontSize: '9px', color: '#666', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '3px' }}>
        {label}
      </div>
      <div style={{ fontSize: '22px', fontWeight: 'bold', color, lineHeight: 1 }}>
        {value}
        <span style={{ fontSize: '11px', color: '#555', marginLeft: '3px' }}>{unit}</span>
      </div>
      {sub && <div style={{ fontSize: '10px', color: '#555', marginTop: '2px' }}>{sub}</div>}
    </div>
  );
}

// ── Chart label ───────────────────────────────────────────────────────────
function ChartLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>
      {children}
    </div>
  );
}

const MODE_LABELS: Record<HybridSimMode, string> = {
  acc75:    '75 m (FS)',
  acc100:   '0–100 km/h',
  cruise:   'Vakionopeus',
  duration: 'Kesto',
};

// ── Main component ────────────────────────────────────────────────────────
export function HybridTab() {

  // ── EM params ────────────────────────────────────────────────────────────
  // Neumotors 6530/8.5/104 × 2 kpl, planeettavaihde 3:1
  // T_peak/pyörä = 2 × 7.5 Nm × 3 = 45 Nm | P_peak = 2 × 7 kW | P_cont = 2 × 3.5 kW
  const [P_em_peak, setP_em_peak] = useState(14.0);
  const [P_em_cont, setP_em_cont] = useState(7.0);
  const T_em_peak = 45;   // Nm at wheel — kiinteä arvo (2 × 7.5 Nm × vaihde 3:1)
  const [em_gear, setEmGear] = useState(3.0);  // planeettavaihde (moottori → pyörä)
  const [eta_em, setEtaEm] = useState(0.88);
  const [eta_regen, setEtaRegen] = useState(0.80);

  // ── ICE params ────────────────────────────────────────────────────────────
  // ice_gear = kokonaisvälitys: ie(1.925) × iv1(2.846) × io(1.733) = 9.50 (1. vaihde, kuiva keli)
  const [ice_gear, setIceGear] = useState(9.5);
  const [bsfc, setBsfc] = useState(300);
  const [ice_start_delay, setIceStartDelay] = useState(0.5);
  const [ice_rpm_min, setIceRpmMin] = useState(1500);

  // ── Battery — 2RC Thevenin ────────────────────────────────────────────────
  const [pack_series, setPackSeries] = useState(13);
  const [pack_parallel, setPackParallel] = useState(1);
  const [pack_Q_Ah, setPackQ] = useState(13.2);
  const [pack_T_celsius, setPackTemp] = useState(25);
  const [soc0, setSoc0] = useState(100);

  // ── Vehicle — M06H lähtötiedot (Ajotilapiirros_Drive_diagram_FSOM06H_2026.xlsx) ──
  const [mass, setMass] = useState(285);          // kg, sis. kuljettaja (210+75)
  const [wheel_d_mm, setWheelD] = useState(398);  // mm, dynaaminen vierintähalkaisija 16x7.5-10
  const [CdA, setCdA] = useState(0.98);         // m², A=1.225 × cA=0.80
  const [Crr, setCrr] = useState(0.018);        // vierintävastuskerroin
  const [mu, setMu] = useState(1.60);           // kitka (slick, kuiva)
  const [h_cg, setHcg] = useState(0.32);        // m, painopiste korkeus (320 mm)
  const [wheelbase, setWheelbase] = useState(1.55); // m, akseliväli
  const [f_front, setFFront] = useState(0.39);  // etupainojako 38.7 %

  // ── Sim mode ──────────────────────────────────────────────────────────────
  const [mode, setMode] = useState<HybridSimMode>('acc75');
  const [duration, setDuration] = useState(20);
  const [cruise_spd, setCruiseSpd] = useState(80);
  const [showComponents, setShowComponents] = useState(false);

  // ── Simulation result ─────────────────────────────────────────────────────
  const [data, setData] = useState<HybridPoint[]>([]);
  const [summary, setSummary] = useState<HybridSummary | null>(null);
  const [runMs, setRunMs] = useState(0);

  // ── ICE peak info (static) ────────────────────────────────────────────────
  const icePeakTorque = Math.max(...ICE_TORQUE_CURVE.map(c => c[1]));
  const icePeakPower = Math.max(
    ...ICE_TORQUE_CURVE.map(([rpm, T]: [number, number]) => T * rpm * 2 * Math.PI / 60 / 1000)
  );

  // ── Auto-run on param change (debounced 450 ms) ───────────────────────────
  const runSim = useCallback(() => {
    const t0 = performance.now();
    const result = runHybridSim({
      P_em_peak_kW: P_em_peak,
      P_em_cont_kW: P_em_cont,
      T_em_peak_Nm: T_em_peak,
      em_gear,
      eta_em,
      eta_regen,
      ice_gear,
      bsfc_gkWh: bsfc,
      ice_start_delay_s: ice_start_delay,
      ice_rpm_min,
      pack_series,
      pack_parallel,
      pack_Q_Ah,
      pack_T_celsius,
      mass_kg: mass,
      wheel_r_m: wheel_d_mm / 2000,
      CdA_m2: CdA,
      Crr,
      mu,
      h_cg_m: h_cg,
      wheelbase_m: wheelbase,
      f_front,
      mode,
      soc0_pct: soc0,
      duration_s: duration,
      cruise_speed_kmh: cruise_spd,
    });
    setData(result.data);
    setSummary(result.summary);
    setRunMs(Math.round(performance.now() - t0));
  }, [
    P_em_peak, P_em_cont, T_em_peak, em_gear, eta_em, eta_regen,
    ice_gear, bsfc, ice_start_delay, ice_rpm_min,
    pack_series, pack_parallel, pack_Q_Ah, pack_T_celsius, soc0,
    mass, wheel_d_mm, CdA, Crr, mu, h_cg, wheelbase, f_front,
    mode, duration, cruise_spd,
  ]);

  useEffect(() => {
    const id = setTimeout(runSim, 450);
    return () => clearTimeout(id);
  }, [runSim]);

  // Käyttöpiste hyötysuhdekartoille: suurimman EM-tehon hetki
  const maxPt = useMemo(() =>
    data.length > 0
      ? data.reduce((best, pt) => pt.P_em_kW > best.P_em_kW ? pt : best, data[0])
      : null,
    [data],
  );

  const d = data as unknown as Record<string, number>[];

  return (
    <div>
      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px',
        borderBottom: '1px solid #1a1a2a', paddingBottom: '12px',
      }}>
        <div>
          <div style={{ fontSize: '14px', color: '#fff', fontWeight: 'bold', letterSpacing: '1px' }}>
            Hybridijärjestelmä — Yhdistetty Simulaatio
          </div>
          <div style={{ fontSize: '11px', color: '#555', marginTop: '2px' }}>
            Sähkömoottori + ICE (MT-07 690cc) · 2RC Thevenin akkumalli · reaaliaikainen laskenta
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
          {(['acc75', 'acc100', 'cruise', 'duration'] as HybridSimMode[]).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                background: mode === m ? '#4fc3f7' : '#1a1a22',
                color: mode === m ? '#000' : '#888',
                border: '1px solid ' + (mode === m ? '#4fc3f7' : '#333'),
                padding: '5px 14px', fontSize: '11px', cursor: 'pointer',
                fontWeight: mode === m ? 'bold' : 'normal',
                textTransform: 'uppercase', letterSpacing: '1px',
              }}
            >
              {MODE_LABELS[m]}
            </button>
          ))}
          <span style={{ fontSize: '10px', color: '#444', marginLeft: '8px' }}>
            {runMs} ms
          </span>
        </div>
      </div>

      {/* ── Main layout: params left, charts right ───────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '24px' }}>

        {/* ── Left: parameter panels ──────────────────────────────────────── */}
        <div style={{ fontSize: '12px' }}>

          {/* EM */}
          <div style={{
            background: '#0d1a24', border: '1px solid #1e3a4a',
            borderRadius: '3px', padding: '12px 14px', marginBottom: '10px',
          }}>
            <div style={{ fontSize: '11px', color: '#4fc3f7', fontWeight: 'bold', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px' }}>
              Sähkömoottori (BLDC)
            </div>
            <SHead>Teho & vääntö</SHead>
            <ParamGroup label="P_peak" value={P_em_peak} onChange={setP_em_peak} min={0.5} max={50} step={0.5} unit="kW" infoTerm="P_peak" />
            <ParamGroup label="P_cont" value={P_em_cont} onChange={setP_em_cont} min={0.5} max={40} step={0.5} unit="kW" infoTerm="P_cont" />
            <SHead>Voimansiirto</SHead>
            <ParamGroup label="Välityssuhde" value={em_gear} onChange={setEmGear} min={1.0} max={10.0} step={0.1} unit=":1" infoTerm="gear_ratio" />
            <SHead>Hyötysuhde</SHead>
            <ParamGroup label="η EM+ESC" value={eta_em} onChange={setEtaEm} min={0.7} max={0.99} step={0.01} unit="" infoTerm="eta_motor" />
            <ParamGroup label="η regen" value={eta_regen} onChange={setEtaRegen} min={0.5} max={0.95} step={0.01} unit="" infoTerm="eta_regen" />
          </div>

          {/* ICE */}
          <div style={{
            background: '#1a1200', border: '1px solid #3a2a00',
            borderRadius: '3px', padding: '12px 14px', marginBottom: '10px',
          }}>
            <div style={{ fontSize: '11px', color: '#ffa726', fontWeight: 'bold', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px' }}>
              ICE — MT-07 690cc
            </div>
            <SHead>Kinematiikka</SHead>
            <ParamGroup label="Välityssuhde" value={ice_gear} onChange={setIceGear} min={0.5} max={15} step={0.1} unit=":1" infoTerm="gear_ratio" />
            <ParamGroup label="RPM_min" value={ice_rpm_min} onChange={setIceRpmMin} min={500} max={3000} step={100} unit="RPM" infoTerm="rpm" />
            <SHead>Käyttäytyminen</SHead>
            <ParamGroup label="BSFC" value={bsfc} onChange={setBsfc} min={200} max={500} step={10} unit="g/kWh" infoTerm="bsfc" />
            <ParamGroup label="Käynnistysviive" value={ice_start_delay} onChange={setIceStartDelay} min={0} max={5} step={0.1} unit="s" />
            <div style={{ marginTop: '8px', padding: '6px 8px', background: '#111', borderRadius: '2px', fontSize: '11px', color: '#888', lineHeight: 1.7 }}>
              Max teho: <span style={{ color: '#ffa726' }}>{icePeakPower.toFixed(1)}</span> kW<br />
              Max vääntö: <span style={{ color: '#ffa726' }}>{icePeakTorque.toFixed(0)}</span> Nm<br />
              @ välitys {ice_gear}×: <span style={{ color: '#4fc3f7' }}>{(icePeakTorque * ice_gear * 0.97).toFixed(0)}</span> Nm pyörällä
            </div>
          </div>

          {/* Vehicle */}
          <div style={{
            background: '#0f1a0f', border: '1px solid #1a3a1a',
            borderRadius: '3px', padding: '12px 14px', marginBottom: '10px',
          }}>
            <div style={{ fontSize: '11px', color: '#66bb6a', fontWeight: 'bold', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px' }}>
              Ajoneuvo
            </div>
            <ParamGroup label="Massa" value={mass} onChange={setMass} min={100} max={700} step={5} unit="kg" />
            <ParamGroup label="Pyörän halkaisija" value={wheel_d_mm} onChange={setWheelD} min={200} max={800} step={5} unit="mm" />
            <ParamGroup label="CdA" value={CdA} onChange={setCdA} min={0.1} max={2.0} step={0.01} unit="m²" infoTerm="CdA" />
            <ParamGroup label="Crr" value={Crr} onChange={setCrr} min={0.005} max={0.05} step={0.001} unit="" infoTerm="Crr" />
            <ParamGroup label="μ (kitka)" value={mu} onChange={setMu} min={0.5} max={2.5} step={0.05} unit="" infoTerm="mu" />
            <SHead>Ajoneuvodynamiikka</SHead>
            <ParamGroup label="h_CG" value={h_cg} onChange={setHcg} min={0.10} max={0.70} step={0.01} unit="m" />
            <ParamGroup label="Akseliväli" value={wheelbase} onChange={setWheelbase} min={1.0} max={2.5} step={0.01} unit="m" />
            <ParamGroup label="Etupainojako" value={f_front} onChange={setFFront} min={0.30} max={0.70} step={0.01} unit="" />
            <div style={{ marginTop: '6px', padding: '5px 8px', background: '#111', borderRadius: '2px', fontSize: '10px', color: '#666', lineHeight: 1.6 }}>
              Etuakseli: 2× napamoottori (EM)<br />
              Takaakseli: ICE + vaihteisto
            </div>
          </div>

          {/* Battery */}
          <div style={{
            background: '#10101a', border: '1px solid #2a2a3a',
            borderRadius: '3px', padding: '12px 14px', marginBottom: '10px',
          }}>
            <div style={{ fontSize: '11px', color: '#ce93d8', fontWeight: 'bold', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px' }}>
              Akku — 2RC Thevenin
            </div>
            <ParamGroup label="Sarja (S)" value={pack_series} onChange={setPackSeries} min={1} max={30} step={1} unit="S" infoTerm="V_batt" />
            <ParamGroup label="Rinnakkain (P)" value={pack_parallel} onChange={setPackParallel} min={1} max={10} step={1} unit="P" />
            <ParamGroup label="Kapasiteetti" value={pack_Q_Ah} onChange={setPackQ} min={1} max={100} step={0.5} unit="Ah" />
            <ParamGroup label="Lämpötila" value={pack_T_celsius} onChange={setPackTemp} min={-20} max={60} step={1} unit="°C" />
            <ParamGroup label="SOC₀" value={soc0} onChange={setSoc0} min={10} max={100} step={1} unit="%" infoTerm="SOC" />
            <div style={{ marginTop: '8px', padding: '6px 8px', background: '#111', borderRadius: '2px', fontSize: '11px', color: '#888', lineHeight: 1.7 }}>
              NMC R0/R1/R2 haetaan SOC-taulukosta · lämpötilakorjaus R0:lle
            </div>
          </div>

          {/* Mode-specific params */}
          {(mode === 'cruise' || mode === 'duration') && (
            <div style={{
              background: '#131318', border: '1px solid #2a2a3a',
              borderRadius: '3px', padding: '12px 14px',
            }}>
              <div style={{ fontSize: '11px', color: '#888', fontWeight: 'bold', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px' }}>
                Simulointiparametrit
              </div>
              {mode === 'cruise' && (
                <ParamGroup label="Tavoitenopeus" value={cruise_spd} onChange={setCruiseSpd} min={20} max={200} step={5} unit="km/h" />
              )}
              <ParamGroup label="Kesto" value={duration} onChange={setDuration} min={1} max={120} step={1} unit="s" />
            </div>
          )}
        </div>

        {/* ── Right: summary + charts ─────────────────────────────────────── */}
        <div>

          {/* Summary cards */}
          {summary && (
            <div style={{
              background: '#0d0d14', border: '1px solid #1e1e2e', borderRadius: '4px',
              padding: '16px', marginBottom: '20px',
            }}>
              <div style={{ fontSize: '10px', color: '#555', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '12px' }}>
                Yhteenveto
              </div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <SCard
                  label="0→75 m (FS kiihdytys)"
                  value={summary.t75m_s !== null ? summary.t75m_s.toFixed(3) : '—'}
                  unit="s"
                  color="#ffa726"
                />
                <SCard
                  label="0→100 km/h"
                  value={summary.t100_s !== null ? summary.t100_s.toFixed(2) : '—'}
                  unit="s"
                  color="#4fc3f7"
                />
                <SCard
                  label="Huipputeho"
                  value={summary.peak_power_kW.toFixed(1)}
                  unit="kW"
                  color="#ffa726"
                  sub={`${(summary.peak_power_kW * 1.341).toFixed(0)} hp`}
                />
                <SCard
                  label="Max kiihtyvyys"
                  value={summary.peak_a_ms2.toFixed(2)}
                  unit="m/s²"
                  color="#66bb6a"
                  sub={`${(summary.peak_a_ms2 / 9.81).toFixed(2)} g`}
                />
                <SCard
                  label="EM yksin"
                  value={summary.em_only_pct.toFixed(0)}
                  unit="%"
                  color="#4fc3f7"
                  sub="ajasta"
                />
                <SCard
                  label="Hybridiaika"
                  value={summary.hybrid_pct.toFixed(0)}
                  unit="%"
                  color="#ffa726"
                  sub="EM + ICE"
                />
                <SCard
                  label="Akku käytetty"
                  value={(summary.wh_em_total / 1000).toFixed(3)}
                  unit="kWh"
                  color="#ce93d8"
                />
                <SCard
                  label="Polttoaine"
                  value={summary.fuel_ml_total.toFixed(1)}
                  unit="ml"
                  color="#ef5350"
                  sub={`${summary.fuel_g_total.toFixed(1)} g`}
                />
                <SCard
                  label="Järjestelmä η"
                  value={summary.eta_sys_avg_pct.toFixed(1)}
                  unit="%"
                  color="#66bb6a"
                />
                <SCard
                  label="Matka"
                  value={summary.distance_m.toFixed(1)}
                  unit="m"
                  color="#888"
                />
              </div>
            </div>
          )}

          {/* ── Hyötysuhdekartat ────────────────────────────────────── */}
          <div style={{ marginBottom: '16px' }}>
            <ChartLabel>Hyötysuhdekartat — ● huipputehon käyttöpiste</ChartLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
              <div>
                <div style={{ fontSize: '9px', color: '#4fc3f7', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '1px' }}>BLDC1 — Etuvasen</div>
                <HybridBldcMap
                  label="BLDC1"
                  labelColor="#4fc3f7"
                  opRpm={maxPt?.RPM_bldc}
                  opTorque={maxPt?.T_motor_Nm}
                />
              </div>
              <div>
                <div style={{ fontSize: '9px', color: '#81d4fa', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '1px' }}>BLDC2 — Etuoikea</div>
                <HybridBldcMap
                  label="BLDC2"
                  labelColor="#81d4fa"
                  opRpm={maxPt?.RPM_bldc}
                  opTorque={maxPt?.T_motor_Nm}
                />
              </div>
              <div>
                <div style={{ fontSize: '9px', color: '#ffa726', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '1px' }}>ICE — MT-07 690cc</div>
                <HybridIceMap
                  bsfc_gkWh={bsfc}
                  opRpm={maxPt?.RPM_ice}
                  opTorque={maxPt?.T_ice_shaft_Nm}
                />
              </div>
            </div>
          </div>

          {/* Toggle: show components */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <span style={{ fontSize: '10px', color: '#555', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Kuvaajat
            </span>
            <button
              onClick={() => setShowComponents(s => !s)}
              style={{
                background: showComponents ? '#222' : '#1a1a22',
                color: showComponents ? '#4fc3f7' : '#555',
                border: '1px solid ' + (showComponents ? '#4fc3f7' : '#333'),
                padding: '3px 10px', fontSize: '10px', cursor: 'pointer',
                textTransform: 'uppercase', letterSpacing: '1px',
              }}
            >
              {showComponents ? '▼ Komponentit näkyvissä' : '▶ Näytä komponentit erikseen'}
            </button>
          </div>

          {/* ── Chart 1: Power (kW) ─────────────────────────────────────── */}
          <div style={{ marginBottom: '16px' }}>
            <ChartLabel>Teho (kW) — Yhdistetty järjestelmä</ChartLabel>
            <LineChart
              data={d}
              series={[
                { key: 'P_total_kW', color: '#ffffff', label: 'P_total', lineWidth: 2.5 },
                ...(showComponents ? [
                  { key: 'P_BLDC1_kW', color: '#4fc3f7', label: 'BLDC1', lineWidth: 1.5 },
                  { key: 'P_BLDC2_kW', color: '#81d4fa', label: 'BLDC2', lineWidth: 1.5, dashed: true },
                  { key: 'P_ice_kW', color: '#ffa726', label: 'P_ice', lineWidth: 1.5 },
                  { key: 'P_demand_kW', color: '#333', label: 'P_tarve', lineWidth: 1, dashed: true },
                ] : [
                  { key: 'P_em_kW', color: '#4fc3f7', label: 'P_em', lineWidth: 1, dashed: true },
                  { key: 'P_ice_kW', color: '#ffa726', label: 'P_ice', lineWidth: 1, dashed: true },
                ]),
              ]}
              xKey="t"
              height={200}
              yUnit=" kW"
              yMin={0}
              extraTooltipRows={(pt) => [
                { label: 'BLDC1', value: `${(pt.I_BLDC1 ?? 0).toFixed(0)}A | ${(pt.T_BLDC1 ?? 25).toFixed(0)}°C`, color: '#4fc3f7' },
                { label: 'BLDC2', value: `${(pt.I_BLDC2 ?? 0).toFixed(0)}A | ${(pt.T_BLDC2 ?? 25).toFixed(0)}°C`, color: '#81d4fa' },
                { label: 'ESC1/2', value: `${(pt.T_ESC1 ?? 25).toFixed(0)}/${(pt.T_ESC2 ?? 25).toFixed(0)}°C`, color: '#ef5350' },
                { label: 'ICE', value: `${(pt.P_ice_kW ?? 0).toFixed(1)}kW @ ${(pt.RPM_ice ?? 0).toFixed(0)}rpm | η${((pt.eta_ice ?? 0) * 100).toFixed(0)}%`, color: '#ffa726' },
              ]}
            />
          </div>

          {/* ── Chart 2: Speed & acceleration ─────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <ChartLabel>Nopeus (km/h)</ChartLabel>
              <LineChart
                data={d}
                series={[{ key: 'v_kmh', color: '#66bb6a', label: 'v', lineWidth: 2 }]}
                xKey="t"
                height={160}
                yUnit=" km/h"
                yMin={0}
                hLines={[{ value: 100, color: 'rgba(255,255,255,0.2)' }]}
              />
            </div>
            <div>
              <ChartLabel>Kiihtyvyys (m/s²)</ChartLabel>
              <LineChart
                data={d}
                series={[{ key: 'a_ms2', color: '#ce93d8', label: 'a', lineWidth: 2 }]}
                xKey="t"
                height={160}
                yUnit=" m/s²"
              />
            </div>
          </div>

          {/* ── Chart 3: Energy ─────────────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <ChartLabel>Energia akkusta (Wh)</ChartLabel>
              <LineChart
                data={d}
                series={[{ key: 'wh_em', color: '#ce93d8', label: 'E_bat', lineWidth: 2 }]}
                xKey="t"
                height={160}
                yUnit=" Wh"
                yMin={0}
              />
            </div>
            <div>
              <ChartLabel>Kumulatiivinen polttoaine (g)</ChartLabel>
              <LineChart
                data={d}
                series={[{ key: 'fuel_g', color: '#ef5350', label: 'Fuel', lineWidth: 2 }]}
                xKey="t"
                height={160}
                yUnit=" g"
                yMin={0}
              />
            </div>
          </div>

          {/* ── Chart 4: SOC + efficiency ──────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <ChartLabel>Akun varaus SOC (%)</ChartLabel>
              <LineChart
                data={d}
                series={[{ key: 'soc', color: '#4fc3f7', label: 'SOC', lineWidth: 2 }]}
                xKey="t"
                height={160}
                yUnit=" %"
                yMin={0}
                yMax={105}
              />
            </div>
            <div>
              <ChartLabel>Järjestelmähyötysuhde (%)</ChartLabel>
              <LineChart
                data={d}
                series={[{ key: 'eta_sys', color: '#66bb6a', label: 'η_sys', lineWidth: 2 }]}
                xKey="t"
                height={160}
                yUnit=" %"
                yMin={0}
                yMax={105}
              />
            </div>
          </div>

          {/* ── Chart 5: Torques ────────────────────────────────────────── */}
          {showComponents && (
            <div style={{ marginBottom: '16px' }}>
              <ChartLabel>Vääntömomentit pyörällä (Nm)</ChartLabel>
              <LineChart
                data={d}
                series={[
                  { key: 'T_total_Nm', color: '#ffffff', label: 'T_total', lineWidth: 2.5 },
                  { key: 'T_em_Nm', color: '#4fc3f7', label: 'T_em' },
                  { key: 'T_ice_Nm', color: '#ffa726', label: 'T_ice' },
                ]}
                xKey="t"
                height={180}
                yUnit=" Nm"
                yMin={0}
              />
            </div>
          )}

          {/* ── Chart 6: Axle normal forces ─────────────────────────────── */}
          {showComponents && (
            <div style={{ marginBottom: '16px' }}>
              <ChartLabel>Akselinormaalivoima — painonsiirto (N)</ChartLabel>
              <LineChart
                data={d}
                series={[
                  { key: 'N_f', color: '#4fc3f7', label: 'N_f (EM)', lineWidth: 2 },
                  { key: 'N_r', color: '#ffa726', label: 'N_r (ICE)', lineWidth: 2 },
                ]}
                xKey="t"
                height={160}
                yUnit=" N"
                yMin={0}
              />
            </div>
          )}

          {/* ── Chart 7: Battery electrical ─────────────────────────────── */}
          {showComponents && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <ChartLabel>Virta (A)</ChartLabel>
                <LineChart
                  data={d}
                  series={[
                    { key: 'I_bat',   color: '#ef5350', label: 'I_bat', lineWidth: 2 },
                    { key: 'I_BLDC1', color: '#4fc3f7', label: 'I_BLDC1', lineWidth: 1.5, dashed: true },
                    { key: 'I_BLDC2', color: '#81d4fa', label: 'I_BLDC2', lineWidth: 1, dashed: true },
                  ]}
                  xKey="t"
                  height={150}
                  yUnit=" A"
                  yMin={0}
                />
              </div>
              <div>
                <ChartLabel>Akkujännite (V)</ChartLabel>
                <LineChart
                  data={d}
                  series={[
                    { key: 'V_bat', color: '#ffca28', label: 'V_bat' },
                    { key: 'V_rc1', color: '#ef9a9a', label: 'V_rc1', lineWidth: 1, dashed: true },
                    { key: 'V_rc2', color: '#f48fb1', label: 'V_rc2', lineWidth: 1, dashed: true },
                  ]}
                  xKey="t"
                  height={150}
                  yUnit=" V"
                />
              </div>
            </div>
          )}

          {/* ── Chart 8: Motor I / P_elec / P_mech vs speed ──────────── */}
          {showComponents && (
            <div style={{ marginBottom: '16px' }}>
              <ChartLabel>BLDC — Virta & teho vs nopeus</ChartLabel>
              <LineChart
                data={d}
                series={[
                  { key: 'I_BLDC1',        color: '#4fc3f7', label: 'I (A)',       lineWidth: 2 },
                  { key: 'P_elec_BLDC_kW', color: '#ef5350', label: 'P_otto (kW)', lineWidth: 2 },
                  { key: 'P_BLDC1_kW',     color: '#66bb6a', label: 'P_anto (kW)', lineWidth: 2 },
                ]}
                xKey="v_kmh"
                xUnit=" km/h"
                height={200}
                yMin={0}
              />
            </div>
          )}

          {/* ── Chart 9: Component temperatures ─────────────────────────── */}
          {showComponents && (
            <div style={{ marginBottom: '16px' }}>
              <ChartLabel>Komponenttilämpötilat (°C)</ChartLabel>
              <LineChart
                data={d}
                series={[
                  { key: 'T_BLDC1', color: '#4fc3f7', label: 'BLDC1', lineWidth: 2 },
                  { key: 'T_BLDC2', color: '#81d4fa', label: 'BLDC2', lineWidth: 1.5, dashed: true },
                  { key: 'T_ESC1',  color: '#ef5350', label: 'ESC1',  lineWidth: 1.5 },
                  { key: 'T_ESC2',  color: '#ff8a80', label: 'ESC2',  lineWidth: 1, dashed: true },
                  { key: 'T_ice_C', color: '#ffa726', label: 'ICE',   lineWidth: 2 },
                ]}
                xKey="t"
                height={180}
                yUnit=" °C"
              />
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
