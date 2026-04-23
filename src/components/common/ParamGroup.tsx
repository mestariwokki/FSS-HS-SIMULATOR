import { NumericInput } from './NumericInput';
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
  infoTerm?: string;
}

export function ParamGroup({ label, value, onChange, min, max, step, unit, title, infoTerm }: ParamGroupProps) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      marginBottom: '7px',
    }}>
      <label
        title={title}
        style={{
          color: '#fff',
          fontSize: '12px',
          whiteSpace: 'nowrap',
          minWidth: '110px',
        }}
      >
        {infoTerm
          ? <InfoTooltip term={infoTerm} label={label} />
          : label}
      </label>
      <NumericInput
        value={value}
        onChange={onChange}
        min={min}
        max={max}
        step={step}
        style={{
          background: '#111',
          color: '#fff',
          border: '1px solid #444',
          padding: '5px 8px',
          fontFamily: "'Courier New', monospace",
          fontSize: '13px',
          width: '90px',
          textAlign: 'right',
        }}
      />
      <span style={{ color: '#ccc', fontSize: '12px', minWidth: '20px' }}>{unit}</span>
    </div>
  );
}
