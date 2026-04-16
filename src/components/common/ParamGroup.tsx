import { InfoTooltip } from './InfoTooltip';

interface ParamGroupProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit: string;
  title?: string;
  /** Key in tooltips.ts to attach an InfoTooltip to the label */
  infoTerm?: string;
}

export function ParamGroup({ label, value, onChange, min, max, step, unit, title, infoTerm }: ParamGroupProps) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      marginBottom: '6px',
    }}>
      <label
        title={title}
        style={{
          color: 'var(--text-secondary)',
          fontSize: '12px',
          whiteSpace: 'nowrap',
          minWidth: '110px',
        }}
      >
        {infoTerm
          ? <InfoTooltip term={infoTerm} label={label} />
          : label}
      </label>
      <input
        type="number"
        value={value}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        min={min}
        max={max}
        step={step}
        style={{
          width: '90px',
          textAlign: 'right',
        }}
      />
      <span style={{ color: 'var(--text-dim)', fontSize: '12px', minWidth: '20px' }}>{unit}</span>
    </div>
  );
}
