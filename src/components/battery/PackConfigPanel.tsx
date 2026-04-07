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
      <div style={{ paddingRight: '18px', borderRight: '1px solid #222' }}>
        <div style={{ fontSize: '10px', color: '#ccc', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '10px', paddingBottom: '5px', borderBottom: '1px solid #2a2a2a' }}>
          Cell
        </div>
        <PresetSelector presets={presets} selectedId={selectedPresetId} onSelect={onPresetSelect} />
        <ParamGroup label="Capacity" value={capacity} onChange={v => onChange('capacity', v)} min={0.1} max={100} step={0.1} unit="Ah" />
        <ParamGroup label="V max" value={vMax} onChange={v => onChange('vMax', v)} min={3.0} max={5.0} step={0.01} unit="V" />
        <ParamGroup label="V nom" value={vNom} onChange={v => onChange('vNom', v)} min={2.5} max={4.5} step={0.01} unit="V" />
        <ParamGroup label="V min" value={vMin} onChange={v => onChange('vMin', v)} min={2.0} max={4.0} step={0.01} unit="V" />
        <div style={{ display: 'flex', gap: '4px', marginTop: '8px', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid #2a2a2a' }}>
          <input
            type="text"
            value={presetName}
            onChange={e => setPresetName(e.target.value)}
            placeholder="Save as..."
            style={{
              flex: 1, minWidth: 0, background: '#111', color: '#fff',
              border: '1px solid #444', padding: '4px 8px',
              fontFamily: "'Courier New', monospace", fontSize: '11px',
            }}
          />
          <button onClick={handleSave} style={{ padding: '4px 10px', fontSize: '11px', borderColor: '#4fc3f7', color: '#4fc3f7', background: '#1a1a1a', border: '1px solid #4fc3f7', cursor: 'pointer', fontFamily: "'Courier New', monospace" }}>+ SAVE</button>
          <button onClick={() => onDeletePreset(selectedPresetId)} style={{ padding: '4px 10px', fontSize: '11px', borderColor: '#ef5350', color: '#ef5350', background: '#1a1a1a', border: '1px solid #ef5350', cursor: 'pointer', fontFamily: "'Courier New', monospace" }}>x</button>
        </div>
      </div>

      {/* Pack column */}
      <div style={{ padding: '0 18px', borderRight: '1px solid #222' }}>
        <div style={{ fontSize: '10px', color: '#ccc', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '10px', paddingBottom: '5px', borderBottom: '1px solid #2a2a2a' }}>
          Pack
        </div>
        <ParamGroup label="Series (S)" value={series} onChange={v => onChange('series', v)} min={1} max={40} step={1} unit="cells" />
        <ParamGroup label="Parallel (P)" value={parallel} onChange={v => onChange('parallel', v)} min={1} max={20} step={1} unit="cells" />
        <ParamGroup label="Resistance" value={resistance} onChange={v => onChange('resistance', v)} min={1} max={500} step={1} unit="mOhm" />
        <ParamGroup label="Thermal mass" value={thermalMass} onChange={v => onChange('thermalMass', v)} min={10} max={20000} step={100} unit="J/K" />
        <ParamGroup label="Cooling hA" value={coolingUA} onChange={v => onChange('coolingUA', v)} min={0} max={500} step={1} unit="W/K" />
        <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #2a2a2a', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 8px' }}>
          <div><span style={{ fontSize: '10px', color: '#bbb' }}>V max pack</span><div style={{ fontSize: '13px', fontWeight: 'bold', color: '#4fc3f7' }}>{(vMax * series).toFixed(2)} V</div></div>
          <div><span style={{ fontSize: '10px', color: '#bbb' }}>V nom pack</span><div style={{ fontSize: '13px', fontWeight: 'bold', color: '#fff' }}>{(vNom * series).toFixed(2)} V</div></div>
          <div><span style={{ fontSize: '10px', color: '#bbb' }}>V min pack</span><div style={{ fontSize: '13px', fontWeight: 'bold', color: '#ef5350' }}>{(vMin * series).toFixed(2)} V</div></div>
          <div><span style={{ fontSize: '10px', color: '#bbb' }}>Capacity</span><div style={{ fontSize: '13px', fontWeight: 'bold', color: '#66bb6a' }}>{(capacity * parallel).toFixed(1)} Ah</div></div>
        </div>
      </div>

      {/* Simulation column - placeholder, actual SimMode panel goes here */}
      <div style={{ paddingLeft: '18px' }}>
        {/* Rendered externally by BatteryTab */}
      </div>
    </div>
  );
}
