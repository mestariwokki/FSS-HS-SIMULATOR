import type { CellPreset } from '../../types';

interface PresetSelectorProps {
  presets: CellPreset[];
  selectedId: string;
  onSelect: (id: string) => void;
}

export function PresetSelector({ presets, selectedId, onSelect }: PresetSelectorProps) {
  const builtins = presets.filter(p => p.builtin);
  const customs = presets.filter(p => !p.builtin);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '7px' }}>
      <label style={{ color: 'var(--text-secondary)', fontSize: '12px', whiteSpace: 'nowrap', minWidth: '110px' }}>
        Selection
      </label>
      <select
        value={selectedId}
        onChange={e => onSelect(e.target.value)}
        style={{
          fontSize: '11px',
          flex: 1,
          minWidth: 0,
        }}
      >
        <option value="">-- select cell --</option>
        <optgroup label="Built-in">
          {builtins.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </optgroup>
        {customs.length > 0 && (
          <optgroup label="Custom">
            {customs.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </optgroup>
        )}
      </select>
    </div>
  );
}
