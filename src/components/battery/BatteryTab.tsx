import { useState, useCallback, useMemo } from 'react';
import type { PackConfig, EcmConfig, SimMode, ProfileStep } from '../../types';
import { useBatterySim } from '../../hooks/useBatterySim';
import { usePresets } from '../../hooks/usePresets';
import { PackConfigPanel } from './PackConfigPanel';
import { SimModePanel } from './SimModePanel';
import { SoHPanel } from './SoHPanel';
import { LiveValues } from './LiveValues';
import { AlertBar } from './AlertBar';
import { OcvTable } from './OcvTable';
import { ShortCircuitPanel } from './ShortCircuitPanel';
import { LineChart } from '../charts/LineChart';
import { exportBatteryCSV } from '../../utils/csvExport';
import { calcSoH } from '../../simulation/ecm';

export function BatteryTab() {
  const presets = usePresets();
  const sim = useBatterySim();

  // Pack config state
  const [series, setSeries] = useState(13);
  const [parallel, setParallel] = useState(2);
  const [capacity, setCapacity] = useState(6.6);
  const [vMax, setVMax] = useState(4.45);
  const [vNom, setVNom] = useState(3.90);
  const [vMin, setVMin] = useState(2.75);
  const [resistance, setResistance] = useState(24);
  const [thermalMass, setThermalMass] = useState(2700);
  const [coolingUA, setCoolingUA] = useState(10);

  // Sim mode state
  const [mode, setMode] = useState<SimMode>('const');
  const [current, setCurrent] = useState(250);
  const [duration, setDuration] = useState(10);
  const [profileSteps, setProfileSteps] = useState<ProfileStep[]>([
    { duration_s: 60, current_A: 100 },
    { duration_s: 120, current_A: 50 },
    { duration_s: 60, current_A: -26 },
  ]);
  const [chargeCurrent, setChargeCurrent] = useState(13);
  const [chargeCutoff, setChargeCutoff] = useState(1);
  const [chargeDuration, setChargeDuration] = useState(3600);
  const [ocLimit, setOcLimit] = useState(250);
  const [tLimit, setTLimit] = useState(60);
  const [t0, setT0] = useState(25);
  const [soc0, setSoc0] = useState(100);

  // ECM state
  const [cycles, setCycles] = useState(0);
  const [r1, setR1] = useState(10);
  const [tau1, setTau1] = useState(5);
  const [r2, setR2] = useState(15);
  const [tau2, setTau2] = useState(50);

  const pack: PackConfig = useMemo(() => ({
    series,
    parallel,
    cell: { capacity_Ah: capacity, v_max: vMax, v_nom: vNom, v_min: vMin },
    resistance_Ohm: resistance / 1000,
    thermalMass_JK: thermalMass,
    coolingUA_WK: coolingUA,
    v_max: vMax * series,
    v_nom: vNom * series,
    v_min: vMin * series,
    capacity_Ah: capacity * parallel,
    i_max: 198,
  }), [series, parallel, capacity, vMax, vNom, vMin, resistance, thermalMass, coolingUA]);

  const soh = calcSoH(cycles, 1.5e-4, 4.0e-4);
  const ecm: EcmConfig = useMemo(() => ({
    R1_Ohm: r1 / 1000,
    tau1_s: tau1,
    R2_Ohm: r2 / 1000,
    tau2_s: tau2,
    cycles,
    kQ: 1.5e-4,
    kR: 4.0e-4,
    soh_cap: soh.soh_cap,
    soh_res: soh.soh_res,
  }), [r1, tau1, r2, tau2, cycles, soh]);

  const handlePresetSelect = useCallback((id: string) => {
    presets.setSelectedId(id);
    const p = presets.allPresets.find(pr => pr.id === id);
    if (p) {
      setSeries(p.series);
      setParallel(p.parallel);
      setCapacity(p.cell.capacity_Ah);
      setVMax(p.cell.v_max);
      setVNom(p.cell.v_nom);
      setVMin(p.cell.v_min);
      setResistance(p.resistance_mOhm);
      setThermalMass(p.thermalMass_JK);
      setCoolingUA(p.coolingUA_WK);
    }
  }, [presets]);

  const handleConfigChange = useCallback((field: string, value: number) => {
    const setters: Record<string, (v: number) => void> = {
      series: setSeries, parallel: setParallel, capacity: setCapacity,
      vMax: setVMax, vNom: setVNom, vMin: setVMin,
      resistance: setResistance, thermalMass: setThermalMass, coolingUA: setCoolingUA,
    };
    setters[field]?.(value);
  }, []);

  const handleStart = useCallback(() => {
    sim.start(pack, ecm, mode, soc0, t0, {
      mode,
      current_A: current,
      duration_s: duration,
      profileSteps,
      charge_current_A: chargeCurrent,
      cutoff_current_A: chargeCutoff,
      charge_duration_s: chargeDuration,
    }, { oc_limit: ocLimit, t_limit: tLimit });
  }, [sim, pack, ecm, mode, soc0, t0, current, duration, profileSteps, chargeCurrent, chargeCutoff, chargeDuration, ocLimit, tLimit]);

  const chartData = useMemo(() =>
    sim.data.map(d => ({
      t: d.t,
      v_oc: d.v_oc,
      v_t: d.v_t,
      soc: d.soc,
      ah: Math.abs(d.ah),
      eta_pos: d.eta_pos,
      eta_neg: d.eta_neg,
      eta_tot: d.eta_pos + d.eta_neg,
      T_C: d.T_C,
      p_t: d.i_bat * d.v_t / 1000,
      p_oc: d.i_bat * d.v_oc / 1000,
    })),
    [sim.data],
  );

  const effectiveDuration = mode === 'const' ? duration
    : mode === 'profile' ? profileSteps.reduce((s, step) => s + step.duration_s, 0)
    : chargeDuration;

  return (
    <div>
      {/* Control Panel */}
      <div style={{ background: 'var(--bg-root)', border: '1px solid var(--border-dim)', borderRadius: '4px', padding: '4px', marginBottom: '16px' }}>
        <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-main)', padding: '12px 14px' }}>
          <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '2px', borderBottom: '1px solid var(--border-dim)', paddingBottom: '6px', marginBottom: '10px' }}>
            HSC Configuration
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 0 }}>
            {/* Cell + Pack columns from PackConfigPanel */}
            <div style={{ paddingRight: '18px', borderRight: '1px solid var(--border-dim)' }}>
              <PackConfigPanel
                series={series} parallel={parallel} capacity={capacity}
                vMax={vMax} vNom={vNom} vMin={vMin}
                resistance={resistance} thermalMass={thermalMass} coolingUA={coolingUA}
                presets={presets.allPresets} selectedPresetId={presets.selectedId}
                onPresetSelect={handlePresetSelect}
                onSavePreset={presets.savePreset}
                onDeletePreset={presets.deletePreset}
                onChange={handleConfigChange}
              />
            </div>
            <div /> {/* Pack column already rendered inside PackConfigPanel grid */}
            <div style={{ paddingLeft: '18px' }}>
              <SimModePanel
                mode={mode} onModeChange={setMode}
                current={current} duration={duration}
                onCurrentChange={setCurrent} onDurationChange={setDuration}
                profileSteps={profileSteps} onProfileChange={setProfileSteps}
                chargeCurrent={chargeCurrent} chargeCutoff={chargeCutoff} chargeDuration={chargeDuration}
                onChargeCurrentChange={setChargeCurrent} onChargeCutoffChange={setChargeCutoff}
                onChargeDurationChange={setChargeDuration}
                ocLimit={ocLimit} tLimit={tLimit}
                onOcLimitChange={setOcLimit} onTLimitChange={setTLimit}
                t0={t0} soc0={soc0} onT0Change={setT0} onSoc0Change={setSoc0}
              />
              <SoHPanel
                cycles={cycles} r1={r1} tau1={tau1} r2={r2} tau2={tau2}
                onCyclesChange={setCycles} onR1Change={setR1} onTau1Change={setTau1}
                onR2Change={setR2} onTau2Change={setTau2}
              />
            </div>
          </div>
        </div>

        {/* Run Bar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          background: 'var(--bg-root)', border: '1px solid var(--border-main)', padding: '9px 14px', marginTop: '4px',
        }}>
          {!sim.running ? (
            <button onClick={handleStart} style={{ background: 'var(--bg-active)', color: 'var(--accent-vehicle)', border: '1px solid var(--accent-vehicle)', padding: '6px 18px', fontSize: '12px', cursor: 'pointer', letterSpacing: '1px' }}>
              ▶ START
            </button>
          ) : (
            <button onClick={sim.pause} style={{ background: 'var(--bg-active)', color: '#ffca28', border: '1px solid #ffca28', padding: '6px 18px', fontSize: '12px', cursor: 'pointer', letterSpacing: '1px' }}>
              {sim.paused ? '▶ RESUME' : '⏸ PAUSE'}
            </button>
          )}
          <button onClick={sim.reset} style={{ background: 'var(--bg-panel)', color: 'var(--text-secondary)', border: '1px solid var(--border-bright)', padding: '6px 18px', fontSize: '12px', cursor: 'pointer', letterSpacing: '1px' }}>
            ↺ RESET
          </button>
          <button
            onClick={() => exportBatteryCSV(sim.data, mode, cycles)}
            style={{ background: 'var(--bg-panel)', color: 'var(--accent-em)', border: '1px solid var(--accent-em)', padding: '6px 18px', fontSize: '12px', cursor: 'pointer', marginLeft: '6px', letterSpacing: '1px' }}
          >
            ↓ CSV
          </button>
          <span style={{ color: 'var(--text-dim)', fontSize: '12px', marginLeft: '8px' }}>{sim.status}</span>
        </div>
      </div>

      {/* Alerts */}
      <AlertBar data={sim.data} pack={pack} ocLimit={ocLimit} tLimit={tLimit} />

      {/* Main Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '20px' }}>
        {/* Left: Live values */}
        <div>
          <LiveValues data={sim.data} pack={pack} ecm={ecm} simState={sim.simState} duration={effectiveDuration} />
        </div>

        {/* Right: Charts */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '6px' }}>
              Voltage vs Time
            </div>
            <div style={{ border: '1px solid var(--border-main)', overflow: 'hidden' }}>
              <LineChart
                data={chartData}
                series={[
                  { key: 'v_oc', color: '#4fc3f7', label: 'V_OCV', lineWidth: 1.2 },
                  { key: 'v_t', color: '#66bb6a', label: 'V_terminal', lineWidth: 2 },
                ]}
                xKey="t"
                height={200}
                yUnit="V"
                hLines={[
                  { value: pack.v_nom, color: 'rgba(255,255,255,0.06)' },
                  { value: pack.v_min, color: 'rgba(239,83,80,0.2)' },
                ]}
              />
            </div>
          </div>

          <div>
            <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '6px' }}>
              SOC & Ah vs Time
            </div>
            <div style={{ border: '1px solid var(--border-main)', overflow: 'hidden' }}>
              <LineChart
                data={chartData}
                series={[
                  { key: 'soc', color: '#4fc3f7', label: 'SOC', lineWidth: 2 },
                  { key: 'ah', color: '#ce93d8', label: 'Ah', lineWidth: 1.5 },
                ]}
                xKey="t"
                height={140}
                yUnit="%"
                yMin={0}
                yMax={100}
              />
            </div>
          </div>

          <div>
            <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '6px' }}>
              Butler-Volmer Overpotential [mV]
            </div>
            <div style={{ border: '1px solid var(--border-main)', overflow: 'hidden' }}>
              <LineChart
                data={chartData}
                series={[
                  { key: 'eta_pos', color: '#ffca28', label: 'η_pos', lineWidth: 1.5 },
                  { key: 'eta_neg', color: '#66bb6a', label: 'η_neg', lineWidth: 1.5 },
                  { key: 'eta_tot', color: '#ffa726', label: 'η_tot', lineWidth: 2 },
                ]}
                xKey="t"
                height={140}
                yUnit="mV"
                smooth
              />
            </div>
          </div>

          <div>
            <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '6px' }}>
              Cell Temperature [°C]
            </div>
            <div style={{ border: '1px solid var(--border-main)', overflow: 'hidden' }}>
              <LineChart
                data={chartData}
                series={[
                  { key: 'T_C', color: '#ffa726', label: 'T_cell', lineWidth: 2 },
                ]}
                xKey="t"
                height={120}
                yUnit="°C"
                hLines={[{ value: tLimit, color: 'rgba(255,152,0,0.3)' }]}
              />
            </div>
          </div>

          <div>
            <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '6px' }}>
              Pack Power [kW]
            </div>
            <div style={{ border: '1px solid var(--border-main)', overflow: 'hidden' }}>
              <LineChart
                data={chartData}
                series={[
                  { key: 'p_t', color: '#ef5350', label: 'P_terminal', lineWidth: 2 },
                  { key: 'p_oc', color: '#4fc3f7', label: 'P_OCV', lineWidth: 1.5 },
                ]}
                xKey="t"
                height={130}
                yUnit="kW"
                yMin={0}
                smooth
                extraTooltipRows={pt => [{
                  label: 'ΔP (loss)',
                  value: `${((pt.p_oc ?? 0) - (pt.p_t ?? 0)).toFixed(3)} kW`,
                  color: '#888',
                }]}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom tables */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>
        {/* Summary */}
        <div>
          <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '2px', borderBottom: '1px solid var(--border-dim)', paddingBottom: '5px', marginBottom: '10px' }}>
            Summary
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <tbody>
              <SummaryRow label="Energy discharged" value={`${sim.simState.wh_out.toFixed(2)} Wh`} color="#4fc3f7" />
              <SummaryRow label="Energy charged" value={`${sim.simState.wh_in.toFixed(2)} Wh`} color="#66bb6a" />
              <SummaryRow label="Net (discharge - charge)" value={`${(sim.simState.wh_out - sim.simState.wh_in).toFixed(2)} Wh`} color="#ffca28" />
              <SummaryRow label="Energy remaining" value={`${Math.max(0, pack.capacity_Ah * pack.v_nom - (sim.simState.wh_out - sim.simState.wh_in)).toFixed(1)} Wh`} />
              <SummaryRow label="Pack capacity" value={`${(pack.capacity_Ah * pack.v_nom).toFixed(1)} Wh`} color="#aaa" />
              <SummaryRow label="Min terminal voltage" value={sim.stats.min_v < 99 ? `${sim.stats.min_v.toFixed(2)} V` : '--'} color="#ef5350" />
              <SummaryRow label="Max voltage sag" value={sim.stats.max_vsag > 0 ? `${sim.stats.max_vsag.toFixed(3)} V` : '--'} color="#ce93d8" />
              <SummaryRow label="Max cell temp" value={`${(sim.stats.max_T - 273.15).toFixed(1)} C`} color="#ffa726" />
              <SummaryRow label="Max |eta_tot|" value={`${(sim.stats.max_eta * 1000).toFixed(1)} mV`} color="#ffca28" />
              <SummaryRow label="Data points" value={sim.data.length.toString()} color="#aaa" />
            </tbody>
          </table>
        </div>

        {/* OCV Table */}
        <OcvTable series={series} />
      </div>

      {/* Short circuit panel */}
      <ShortCircuitPanel pack={pack} ecm={ecm} />
    </div>
  );
}

function SummaryRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <tr>
      <td style={{ padding: '4px 8px', borderBottom: '1px solid var(--border-dim)', color: 'var(--text-secondary)' }}>{label}</td>
      <td style={{ textAlign: 'right', padding: '4px 8px', borderBottom: '1px solid var(--border-dim)', color: color ?? 'var(--text-primary)' }}>{value}</td>
    </tr>
  );
}
