import { ParamGroup } from '../common/ParamGroup';
import { PresetSelector } from '../common/PresetSelector';
import type { CellPreset } from '../../types';
import { useState } from 'react';

interface PackConfigPanelProps {
  series: number;
  parallel: number;
  capacity: number;
  vMax: number;
  vNom: number;
  vMin: number;
  resistance: number;
  thermalMass: number;
  coolingUA: number;
  presets: CellPreset[];
  selectedPresetId: string;
  onPresetSelect: (id: string) => void;
  onSavePreset: (preset: Omit<CellPreset, 'builtin'>) => void;
  onDeletePreset: (id: string) => void;
  onChange: (field: string, value: number) => void;
}

export function PackConfigPanel({
  series, parallel, capacity, vMax, vNom, vMin,
  resistance, thermalMass, coolingUA,
  presets, selectedPresetId, onPresetSelect, onSavePreset, onDeletePreset,
  onChange,
}: PackConfigPanelProps) {
  const [presetName, setPresetName] = useState('');

  const handleSave = () => {
    if (!presetName.trim()) return;
    const id = presetName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
    onSavePreset({
      id,
      name: presetName,
      series,
      parallel,
      cell: { capacity_Ah: capacity, v_max: vMax, v_nom: vNom, v_min: vMin },
      resistance_mOhm: resistance,
      thermalMass_JK: thermalMass,
      coolingUA_WK: coolingUA,
    });
    setPresetName('');
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 0 }}>
      {/* Cell column */}
      <div style={{ paddingRight: '18px', borderRight: '1px solid var(--border-dim)' }}>
        <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '10px', paddingBottom: '5px', borderBottom: '1px solid var(--border-dim)' }}>
          Cell
        </div>
        <PresetSelector presets={presets} selectedId={selectedPresetId} onSelect={onPresetSelect} />
        <ParamGroup label="Capacity" value={capacity} onChange={v => onChange('capacity', v)} min={0.1} max={100} step={0.1} unit="Ah" />
        <ParamGroup label="V max" value={vMax} onChange={v => onChange('vMax', v)} min={3.0} max={5.0} step={0.01} unit="V" infoTerm="V_batt" />
        <ParamGroup label="V nom" value={vNom} onChange={v => onChange('vNom', v)} min={2.5} max={4.5} step={0.01} unit="V" />
        <ParamGroup label="V min" value={vMin} onChange={v => onChange('vMin', v)} min={2.0} max={4.0} step={0.01} unit="V" />
        <div style={{ display: 'flex', gap: '4px', marginTop: '8px', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid var(--border-dim)' }}>
          <input
            type="text"
            value={presetName}
            onChange={e => setPresetName(e.target.value)}
            placeholder="Save as..."
            style={{
              flex: 1, minWidth: 0, fontSize: '11px',
            }}
          />
          <button onClick={handleSave} style={{ padding: '4px 10px', fontSize: '11px', color: 'var(--accent-em)', background: 'var(--bg-panel)', border: '1px solid var(--accent-em)', cursor: 'pointer' }}>+ SAVE</button>
          <button onClick={() => onDeletePreset(selectedPresetId)} style={{ padding: '4px 10px', fontSize: '11px', color: 'var(--accent-alert)', background: 'var(--bg-panel)', border: '1px solid var(--accent-alert)', cursor: 'pointer' }}>✕</button>
        </div>
      </div>

      {/* Pack column */}
      <div style={{ padding: '0 18px', borderRight: '1px solid var(--border-dim)' }}>
        <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '10px', paddingBottom: '5px', borderBottom: '1px solid var(--border-dim)' }}>
          Pack
        </div>
        <ParamGroup label="Series (S)" value={series} onChange={v => onChange('series', v)} min={1} max={40} step={1} unit="cells" infoTerm="V_batt" />
        <ParamGroup label="Parallel (P)" value={parallel} onChange={v => onChange('parallel', v)} min={1} max={20} step={1} unit="cells" />
        <ParamGroup label="Resistance" value={resistance} onChange={v => onChange('resistance', v)} min={1} max={500} step={1} unit="mOhm" />
        <ParamGroup label="Thermal mass" value={thermalMass} onChange={v => onChange('thermalMass', v)} min={10} max={20000} step={100} unit="J/K" />
        <ParamGroup label="Cooling hA" value={coolingUA} onChange={v => onChange('coolingUA', v)} min={0} max={500} step={1} unit="W/K" />
        <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--border-dim)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 8px' }}>
          <div><span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>V max pack</span><div style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--accent-em)' }}>{(vMax * series).toFixed(2)} V</div></div>
          <div><span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>V nom pack</span><div style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-primary)' }}>{(vNom * series).toFixed(2)} V</div></div>
          <div><span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>V min pack</span><div style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--accent-alert)' }}>{(vMin * series).toFixed(2)} V</div></div>
          <div><span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>Capacity</span><div style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--accent-vehicle)' }}>{(capacity * parallel).toFixed(1)} Ah</div></div>
        </div>
      </div>

      {/* Simulation column - placeholder, actual SimMode panel goes here */}
      <div style={{ paddingLeft: '18px' }}>
        {/* Rendered externally by BatteryTab */}
      </div>
    </div>
  );
}
