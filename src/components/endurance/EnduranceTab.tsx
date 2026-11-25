import { useState, type ReactNode } from 'react';
import { ParamGroup } from '../common/ParamGroup';
import { ValueBox } from '../common/ValueBox';
import { LineChart } from '../charts/LineChart';
import {
  runHscEndurance, runAcceleration,
  defaultVehicle, defaultStrategy, defaultSetup,
  type EnduranceResult, type AccelResult,
} from '../../simulation/endurance/hscEndurance';
import { defaultPackModel } from '../../simulation/cellModel';
import { HSC_CONCEPTS, type ConceptId } from '../../simulation/hscThermal';
import { FSG_LIKE_LAP, lapLength } from '../../simulation/endurance/track';

type Concept = Exclude<ConceptId, 'custom'>;

function Panel({ title, children, color = 'var(--accent-battery)' }: { title: string; children: ReactNode; color?: string }) {
  return (
    <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-dim)', padding: '12px 14px', marginBottom: '10px' }}>
      <div style={{ fontSize: '10px', color, letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px' }}>{title}</div>
      {children}
    </div>
  );
}

function ChartLabel({ children }: { children: ReactNode }) {
  return <div style={{ fontSize: '10px', color: 'var(--text-dim)', letterSpacing: '1px', textTransform: 'uppercase', margin: '4px 0' }}>{children}</div>;
}

const btn = (active: boolean) => ({
  background: active ? 'var(--bg-active)' : 'var(--bg-input)',
  color: active ? 'var(--accent-battery)' : 'var(--text-dim)',
  border: `1px solid ${active ? 'var(--accent-battery)' : 'var(--border-main)'}`,
  padding: '5px 12px', fontSize: '11px', cursor: 'pointer', letterSpacing: '1px',
});

export function EnduranceTab() {
  const [concept, setConcept] = useState<Concept>('A');
  const [T_amb, setTamb] = useState(30);
  const [T0, setT0] = useState(30);
  const [soc0, setSoc0] = useState(95);
  const [socEnd, setSocEnd] = useState(15);
  const [auto, setAuto] = useState(true);
  const [k, setK] = useState(0.7);
  const [Idis, setIdis] = useState(198);
  const [Ichg, setIchg] = useState(52.8);
  const [regenTmax, setRegenTmax] = useState(43);
  const [bmsT, setBmsT] = useState(58);
  const [grip, setGrip] = useState(0.85);
  const [ClA, setClA] = useState(0);
  const [mass, setMass] = useState(285);
  const [Tmot, setTmot] = useState(7.5);
  const [Gesc, setGesc] = useState(1.3);
  const [laps, setLaps] = useState(21);
  const [Rint, setRint] = useState(1.2);
  const [weakR, setWeakR] = useState(10);

  const [res, setRes] = useState<EnduranceResult | null>(null);
  const [cmp, setCmp] = useState<Record<Concept, EnduranceResult> | null>(null);
  const [acc, setAcc] = useState<AccelResult | null>(null);
  const [ms, setMs] = useState(0);

  const build = () => {
    const base = defaultVehicle();
    const veh = { ...base, grip_usage: grip, ClA_m2: ClA, mass_kg: mass, em: { ...base.em, T_motor_max_Nm: Tmot, G_esc_amb_WK: Gesc } };
    const strat = {
      ...defaultStrategy(),
      deploy: auto ? 'auto' as const : 'manual' as const,
      k_manual: k, soc_target_end: socEnd / 100,
      I_dis_limit_A: Idis, I_chg_limit_A: Ichg, regen_T_max_C: regenTmax,
    };
    const pack = { ...defaultPackModel(), R_hsc_internal_Ohm: Rint / 1000, weak_dR: weakR / 100 };
    const setup = (c: Concept) => ({
      ...defaultSetup(HSC_CONCEPTS[c]),
      T_amb_C: T_amb, T0_C: T0, soc0: soc0 / 100, bms_T_max_C: bmsT,
      n_laps: laps, laps_before_change: Math.floor(laps / 2),
    });
    return { veh, strat, pack, setup };
  };

  const run = () => {
    const t0 = performance.now();
    const { veh, strat, pack, setup } = build();
    setRes(runHscEndurance(veh, strat, pack, setup(concept)));
    setAcc(runAcceleration(veh, strat, pack, soc0 / 100, T0, HSC_CONCEPTS[concept]));
    setMs(Math.round(performance.now() - t0));
  };

  const compare = () => {
    const t0 = performance.now();
    const { veh, strat, pack, setup } = build();
    const out = {} as Record<Concept, EnduranceResult>;
    for (const c of ['A', 'B', 'C', 'V2'] as Concept[]) out[c] = runHscEndurance(veh, strat, pack, setup(c));
    setCmp(out);
    setMs(Math.round(performance.now() - t0));
  };

  const tr = (res?.trace ?? []) as unknown as Record<string, number>[];
  const lapTr = (res?.lap_speed ?? []) as unknown as Record<string, number>[];
  const bestLap = res ? Math.min(...res.lap_times_s.slice(1)) : 0;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px', borderBottom: '1px solid var(--border-dim)', paddingBottom: '10px' }}>
        <div>
          <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 'bold', letterSpacing: '1px' }}>
            Endurance &amp; Acceleration — HSC load and temperature
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }}>
            FSG-style lap ({lapLength(FSG_LIKE_LAP).toFixed(0)} m) · ICE rear + 2 hub motors front · EP9343126VVP 13S2P (T, SOC) · 3-node HSC thermal per concept · BMS T11.7.7
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
          {(['A', 'B', 'C', 'V2'] as Concept[]).map(c => (
            <button key={c} style={btn(concept === c)} onClick={() => setConcept(c)} title={HSC_CONCEPTS[c].name}>
              Concept {c}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', background: '#0f0f14', border: '1px solid #2d2d38', padding: '10px 14px', marginBottom: '16px' }}>
        <button onClick={run} style={{ background: '#66bb6a', color: '#000', border: 'none', padding: '8px 20px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}>RUN</button>
        <button onClick={compare} style={{ background: '#1a1a1a', color: '#ce93d8', border: '1px solid #ce93d8', padding: '8px 16px', fontSize: '13px', cursor: 'pointer' }}>COMPARE A / B / C</button>
        <span style={{ color: '#888', fontSize: '12px' }}>{HSC_CONCEPTS[concept].name} — {HSC_CONCEPTS[concept].note}</span>
        {ms > 0 && <span style={{ color: '#666', fontSize: '12px', marginLeft: 'auto' }}>{ms} ms</span>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '24px' }}>
        <div style={{ fontSize: '12px' }}>
          <Panel title="Event">
            <ParamGroup label="Laps" value={laps} onChange={setLaps} min={1} max={30} step={1} unit="" />
            <ParamGroup label="T ambient" value={T_amb} onChange={setTamb} min={-10} max={45} step={1} unit="°C" />
            <ParamGroup label="T cells start" value={T0} onChange={setT0} min={-10} max={50} step={1} unit="°C" />
            <ParamGroup label="SOC start" value={soc0} onChange={setSoc0} min={10} max={100} step={1} unit="%" />
          </Panel>
          <Panel title="Energy strategy">
            <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
              <button style={btn(auto)} onClick={() => setAuto(true)}>Auto → SOC end</button>
              <button style={btn(!auto)} onClick={() => setAuto(false)}>Manual k</button>
            </div>
            {auto
              ? <ParamGroup label="SOC end target" value={socEnd} onChange={setSocEnd} min={0} max={90} step={1} unit="%" />
              : <ParamGroup label="Deployment k" value={k} onChange={setK} min={0} max={1} step={0.05} unit="" />}
            <ParamGroup label="I discharge max" value={Idis} onChange={setIdis} min={10} max={198} step={1} unit="A" />
            <ParamGroup label="I regen max" value={Ichg} onChange={setIchg} min={0} max={52.8} step={0.1} unit="A" />
            <ParamGroup label="No regen above" value={regenTmax} onChange={setRegenTmax} min={0} max={45} step={1} unit="°C" />
            <ParamGroup label="BMS T limit" value={bmsT} onChange={setBmsT} min={30} max={60} step={1} unit="°C" />
          </Panel>
          <Panel title="Vehicle" color="var(--accent-vehicle)">
            <ParamGroup label="Mass incl. driver" value={mass} onChange={setMass} min={150} max={400} step={1} unit="kg" />
            <ParamGroup label="Grip used" value={grip} onChange={setGrip} min={0.5} max={1} step={0.01} unit="× μ" />
            <ParamGroup label="ClA" value={ClA} onChange={setClA} min={0} max={5} step={0.1} unit="m²" />
          </Panel>
          <Panel title="Hub motors + ESCs" color="var(--accent-em)">
            <ParamGroup label="Motor T max" value={Tmot} onChange={setTmot} min={1} max={15} step={0.1} unit="Nm" />
            <ParamGroup label="ESC cooling" value={Gesc} onChange={setGesc} min={0.2} max={10} step={0.1} unit="W/K" />
            <div style={{ fontSize: '10px', color: 'var(--text-faint)' }}>Neumotors 6530 7.5 Nm / 85 A, ESC 86 A cont / 100 A 5 s (HSF). Losses and thermal: estimates.</div>
          </Panel>
          <Panel title="Pack">
            <ParamGroup label="R busbar+AIR+fuse" value={Rint} onChange={setRint} min={0} max={10} step={0.1} unit="mΩ" />
            <ParamGroup label="Weakest group +R" value={weakR} onChange={setWeakR} min={0} max={50} step={1} unit="%" />
          </Panel>
        </div>

        <div>
          {!res && !cmp && (
            <div style={{ color: 'var(--text-dim)', fontSize: '12px', padding: '20px' }}>
              Press RUN for one concept or COMPARE for A / B / C on the same drive. Defaults: 21 laps (~22.7 km), driver change after lap 10 (3 min, AIR open), 30 °C.
            </div>
          )}

          {cmp && (
            <div style={{ marginBottom: '18px' }}>
              <ChartLabel>Concept comparison — same drive, same strategy</ChartLabel>
              <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ color: 'var(--text-dim)', textAlign: 'right' }}>
                    <th style={{ textAlign: 'left' }}>Concept</th><th>k</th><th>I_rms [A]</th><th>I_peak [A]</th>
                    <th>T sensor max [°C]</th><th>T core max [°C]</th><th>T motor [°C]</th><th>SOC end [%]</th><th>Lap gain [s]</th><th>BMS</th>
                  </tr>
                </thead>
                <tbody>
                  {(['A', 'B', 'C', 'V2'] as Concept[]).map(c => {
                    const r = cmp[c];
                    const gain = r.lap_time_ice_only_s - Math.min(...r.lap_times_s.slice(1));
                    return (
                      <tr key={c} style={{ textAlign: 'right', borderTop: '1px solid var(--border-dim)' }}>
                        <td style={{ textAlign: 'left' }}>{HSC_CONCEPTS[c].name}</td>
                        <td>{r.k.toFixed(2)}</td>
                        <td>{r.I_rms_drive_A.toFixed(0)}</td>
                        <td>{r.I_peak_A.toFixed(0)}</td>
                        <td style={{ color: r.T_sensor_max_C > bmsT - 3 ? 'var(--accent-alert)' : undefined }}>{r.T_sensor_max_C.toFixed(1)}</td>
                        <td>{r.T_hot_max_C.toFixed(1)}</td>
                        <td>{r.T_motor_max_C.toFixed(0)}</td>
                        <td>{(r.soc_end * 100).toFixed(0)}</td>
                        <td>{gain.toFixed(2)}</td>
                        <td style={{ color: r.bms_trip ? 'var(--accent-alert)' : 'var(--accent-vehicle)' }}>{r.bms_trip ? `trip lap ${r.bms_trip_lap}` : 'OK'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {res && (
            <>
              {res.bms_trip && (
                <div style={{ background: '#3a1010', border: '1px solid var(--accent-alert)', color: '#ffb4b4', padding: '8px 12px', marginBottom: '12px', fontSize: '12px' }}>
                  {res.bms_trip} — lap {res.bms_trip_lap}, t = {res.bms_trip_t_s?.toFixed(0)} s. AIR open, rest of the event ICE only.
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '14px' }}>
                <ValueBox label="I_rms (driving)" value={res.I_rms_drive_A.toFixed(1)} unit="A" color="purple" />
                <ValueBox label="I_peak / regen" value={`${res.I_peak_A.toFixed(0)} / ${res.I_regen_peak_A.toFixed(0)}`} unit="A" />
                <ValueBox label="T sensor max" value={res.T_sensor_max_C.toFixed(1)} unit="°C" color={res.T_sensor_max_C > bmsT - 3 ? 'red' : 'green'} />
                <ValueBox label="T core max" value={res.T_hot_max_C.toFixed(1)} unit="°C" />
                <ValueBox label="Deployment k" value={res.k.toFixed(2)} unit="" color="blue" />
                <ValueBox label="SOC end" value={(res.soc_end * 100).toFixed(0)} unit="%" />
                <ValueBox label="Energy out / regen" value={`${res.Wh_out.toFixed(0)} / ${res.Wh_regen.toFixed(0)}`} unit="Wh" />
                <ValueBox label="Avg cell heat" value={res.Q_cells_avg_W.toFixed(0)} unit="W" />
                <ValueBox label="Best lap / ICE only" value={`${bestLap.toFixed(2)} / ${res.lap_time_ice_only_s.toFixed(2)}`} unit="s" color="green" />
                <ValueBox label="Total time" value={res.total_time_s.toFixed(0)} unit="s" />
                <ValueBox label="V cell min / max" value={`${res.V_cell_min.toFixed(2)} / ${res.V_cell_max.toFixed(2)}`} unit="V" />
                <ValueBox label="V HSC max (≤ 60)" value={res.V_hsc_max.toFixed(2)} unit="V" color={res.V_hsc_max < 60 ? 'green' : 'red'} />
                <ValueBox label="Motor winding max" value={res.T_motor_max_C.toFixed(1)} unit="°C" color={res.T_motor_max_C > 85 ? 'red' : 'blue'} />
                <ValueBox label="ESC max" value={res.T_esc_max_C.toFixed(1)} unit="°C" color={res.T_esc_max_C > 85 ? 'red' : 'blue'} />
                <ValueBox label="Drive / regen η" value={`${(res.eta_drive_avg * 100).toFixed(0)} / ${(res.eta_regen_avg * 100).toFixed(0)}`} unit="%" />
                <ValueBox label="EM derated" value={res.em_derate_time_s.toFixed(0)} unit="s" color={res.em_derate_time_s > 0 ? 'red' : 'green'} />
              </div>
              {acc && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '14px' }}>
                  <ValueBox label="75 m hybrid / ICE" value={`${acc.t75_s.toFixed(3)} / ${acc.t75_ice_only_s.toFixed(3)}`} unit="s" color="orange" />
                  <ValueBox label="Accel I_peak" value={acc.I_peak_A.toFixed(0)} unit="A" />
                  <ValueBox label="Accel V cell min" value={acc.V_cell_min.toFixed(3)} unit="V" />
                  <ValueBox label="Accel energy" value={acc.Wh.toFixed(1)} unit="Wh" />
                </div>
              )}

              <ChartLabel>Cell temperature over the event [°C] — sensor (tab/surface, BMS) vs core vs structure</ChartLabel>
              <LineChart data={tr} xKey="t" height={200} xUnit=" s" yUnit=" °C"
                series={[
                  { key: 'T_hot', color: '#ef5350', label: 'core (hottest)', lineWidth: 2 },
                  { key: 'T_sensor', color: '#ffa726', label: 'sensor', lineWidth: 2 },
                  { key: 'T_mean', color: '#ce93d8', label: 'mean cell', lineWidth: 1.5 },
                  { key: 'T_struct', color: '#4fc3f7', label: 'structure', lineWidth: 1.5, dashed: true },
                ]}
                hLines={[{ value: bmsT, color: 'rgba(239,83,80,0.5)' }, { value: 45, color: 'rgba(255,167,38,0.3)' }]}
              />
              <ChartLabel>Hub motor winding and ESC temperature [°C] (VESC derating from 85 °C)</ChartLabel>
              <LineChart data={tr} xKey="t" height={150} xUnit=" s" yUnit=" °C"
                series={[
                  { key: 'T_motor', color: '#4fc3f7', label: 'motor winding', lineWidth: 2 },
                  { key: 'T_esc', color: '#ffa726', label: 'ESC', lineWidth: 2 },
                ]}
                hLines={[{ value: 85, color: 'rgba(239,83,80,0.4)' }]}
              />
              <ChartLabel>HSC current [A] (&gt; 0 discharge)</ChartLabel>
              <LineChart data={tr} xKey="t" height={160} xUnit=" s" yUnit=" A" smooth={false}
                series={[{ key: 'I', color: '#ce93d8', label: 'I', lineWidth: 1 }]}
                hLines={[{ value: 198, color: 'rgba(239,83,80,0.4)' }, { value: -52.8, color: 'rgba(79,195,247,0.4)' }]}
              />
              <ChartLabel>SOC [%] and weakest-cell voltage [V]</ChartLabel>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <LineChart data={tr} xKey="t" height={150} xUnit=" s" yUnit=" %" yMin={0} yMax={100}
                  series={[{ key: 'soc', color: '#66bb6a', label: 'SOC', lineWidth: 2 }]} />
                <LineChart data={tr} xKey="t" height={150} xUnit=" s" yUnit=" V"
                  series={[
                    { key: 'V_cell_min', color: '#ef5350', label: 'V min', lineWidth: 1 },
                    { key: 'V_cell_max', color: '#4fc3f7', label: 'V max', lineWidth: 1 },
                  ]}
                  hLines={[{ value: 2.75, color: 'rgba(239,83,80,0.4)' }, { value: 4.45, color: 'rgba(79,195,247,0.4)' }]}
                />
              </div>
              <ChartLabel>One flying lap — speed [km/h] and HSC power [kW] vs distance</ChartLabel>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <LineChart data={lapTr} xKey="s" height={150} xUnit=" m" yUnit=" km/h" yMin={0} smooth={false}
                  series={[{ key: 'v_kmh', color: '#66bb6a', label: 'v', lineWidth: 1.5 }]} />
                <LineChart data={lapTr} xKey="s" height={150} xUnit=" m" yUnit=" kW" smooth={false}
                  series={[{ key: 'P_kW', color: '#4fc3f7', label: 'P_HSC', lineWidth: 1.5 }]} />
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-faint)', marginTop: '10px', lineHeight: 1.5 }}>
                Estimates, not measurements: cell R(T, SOC), OCV curve and the concept UA/C values are derived from the datasheet and geometry.
                Calibrate with a C/10 OCV test, an HPPC pulse test at 0/25/45 °C and one heating test of the built stack.
                See docs/hsc-model-assumptions.md.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
