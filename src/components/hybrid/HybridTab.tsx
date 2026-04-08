import { useState, useEffect, useCallback } from 'react';
import { runHybridSim, type HybridSimMode, type HybridSummary } from '../../simulation/motor/runHybridSim';
import type { HybridPoint } from '../../simulation/motor/hybridStep';
import { LineChart } from '../charts/LineChart';
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

// ── Main component ────────────────────────────────────────────────────────
export function HybridTab() {

  // ── EM params ────────────────────────────────────────────────────────────
  const [P_em_peak, setP_em_peak] = useState(10.0);
  const [P_em_cont, setP_em_cont] = useState(7.0);
  const [T_em_peak, setT_em_peak] = useState(400);    // Nm at wheel
  const [eta_em, setEtaEm] = useState(0.88);
  const [eta_regen, setEtaRegen] = useState(0.80);

  // ── ICE params ────────────────────────────────────────────────────────────
  const [ice_gear, setIceGear] = useState(3.5);
  const [bsfc, setBsfc] = useState(300);
  const [ice_start_delay, setIceStartDelay] = useState(0.5);
  const [ice_rpm_min, setIceRpmMin] = useState(1500);

  // ── Battery ───────────────────────────────────────────────────────────────
  const [pack_series, setPackSeries] = useState(13);
  const [pack_R_mOhm, setPackR] = useState(24);
  const [pack_Q_Ah, setPackQ] = useState(13.2);
  const [soc0, setSoc0] = useState(100);

  // ── Vehicle ───────────────────────────────────────────────────────────────
  const [mass, setMass] = useState(300);
  const [wheel_r, setWheelR] = useState(0.200);
  const [CdA, setCdA] = useState(0.40);
  const [Crr, setCrr] = useState(0.015);
  const [mu, setMu] = useState(1.60);

  // ── Sim mode ──────────────────────────────────────────────────────────────
  const [mode, setMode] = useState<HybridSimMode>('acc100');
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
      eta_em,
      eta_regen,
      ice_gear,
      bsfc_gkWh: bsfc,
      ice_start_delay_s: ice_start_delay,
      ice_rpm_min,
      pack_series,
      pack_R_Ohm: pack_R_mOhm / 1000,
      pack_Q_Ah,
      mass_kg: mass,
      wheel_r_m: wheel_r,
      CdA_m2: CdA,
      Crr,
      mu,
      mode,
      soc0_pct: soc0,
      duration_s: duration,
      cruise_speed_kmh: cruise_spd,
    });
    setData(result.data);
    setSummary(result.summary);
    setRunMs(Math.round(performance.now() - t0));
  }, [
    P_em_peak, P_em_cont, T_em_peak, eta_em, eta_regen,
    ice_gear, bsfc, ice_start_delay, ice_rpm_min,
    pack_series, pack_R_mOhm, pack_Q_Ah, soc0,
    mass, wheel_r, CdA, Crr, mu,
    mode, duration, cruise_spd,
  ]);

  useEffect(() => {
    const id = setTimeout(runSim, 450);
    return () => clearTimeout(id);
  }, [runSim]);

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
            Sähkömoottori + ICE (MT-07 690cc) · reaaliaikainen laskenta
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
          {(['acc100', 'cruise', 'duration'] as HybridSimMode[]).map(m => (
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
              {m === 'acc100' ? '0–100 km/h' : m === 'cruise' ? 'Vakionopeus' : 'Kesto'}
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
            <ParamGroup label="T_peak wheel" value={T_em_peak} onChange={setT_em_peak} min={50} max={2000} step={10} unit="Nm" />
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
            <ParamGroup label="Pyörän säde" value={wheel_r} onChange={setWheelR} min={0.10} max={0.40} step={0.005} unit="m" />
            <ParamGroup label="CdA" value={CdA} onChange={setCdA} min={0.1} max={1.5} step={0.01} unit="m²" infoTerm="CdA" />
            <ParamGroup label="Crr" value={Crr} onChange={setCrr} min={0.005} max={0.05} step={0.001} unit="" infoTerm="Crr" />
            <ParamGroup label="μ (kitka)" value={mu} onChange={setMu} min={0.5} max={2.5} step={0.05} unit="" infoTerm="mu" />
          </div>

          {/* Battery */}
          <div style={{
            background: '#10101a', border: '1px solid #2a2a3a',
            borderRadius: '3px', padding: '12px 14px', marginBottom: '10px',
          }}>
            <div style={{ fontSize: '11px', color: '#ce93d8', fontWeight: 'bold', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px' }}>
              Akku
            </div>
            <ParamGroup label="Kennojen sarja" value={pack_series} onChange={setPackSeries} min={1} max={30} step={1} unit="S" infoTerm="V_batt" />
            <ParamGroup label="Kapasiteetti" value={pack_Q_Ah} onChange={setPackQ} min={1} max={100} step={0.5} unit="Ah" />
            <ParamGroup label="Sisäresistanssi" value={pack_R_mOhm} onChange={setPackR} min={1} max={500} step={1} unit="mΩ" />
            <ParamGroup label="SOC_0" value={soc0} onChange={setSoc0} min={10} max={100} step={1} unit="%" infoTerm="SOC" />
          </div>

          {/* Mode-specific params */}
          {mode !== 'acc100' && (
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
                  { key: 'P_em_kW', color: '#4fc3f7', label: 'P_em', lineWidth: 1.5 },
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

          {/* ── Chart 6: Battery electrical ─────────────────────────────── */}
          {showComponents && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <ChartLabel>Akkuvirta (A)</ChartLabel>
                <LineChart
                  data={d}
                  series={[{ key: 'I_bat', color: '#ef5350', label: 'I_bat' }]}
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
                  series={[{ key: 'V_bat', color: '#ffca28', label: 'V_bat' }]}
                  xKey="t"
                  height={150}
                  yUnit=" V"
                />
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
