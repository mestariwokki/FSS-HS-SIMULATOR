import { InfoTooltip } from './InfoTooltip';

interface ValueBoxProps {
  label: string;
  value: string;
  unit: string;
  color?: 'blue' | 'green' | 'red' | 'yellow' | 'purple' | 'orange';
  tooltip?: string;
  fontSize?: string;
  /** Key in tooltips.ts to show an InfoTooltip on hover of the label */
  infoTerm?: string;
}

const COLOR_MAP: Record<string, string> = {
  blue:   'var(--accent-em)',
  green:  'var(--accent-vehicle)',
  red:    'var(--accent-alert)',
  yellow: '#ffca28',
  purple: 'var(--accent-battery)',
  orange: 'var(--accent-ice)',
};

export function ValueBox({ label, value, unit, color, tooltip, fontSize, infoTerm }: ValueBoxProps) {
  const valColor = color ? COLOR_MAP[color] : 'var(--text-primary)';
  return (
    <div
      className="vbox"
      title={infoTerm ? undefined : tooltip}
      style={{
        background: 'var(--bg-panel)',
        border: '1px solid var(--border-main)',
        padding: '8px 12px',
        cursor: tooltip && !infoTerm ? 'help' : undefined,
      }}
    >
      <div style={{
        fontSize: '10px',
        color: 'var(--text-dim)',
        textTransform: 'uppercase',
        letterSpacing: '1px',
        marginBottom: '3px',
      }}>
        {infoTerm ? <InfoTooltip term={infoTerm} label={label} /> : label}
      </div>
      <div style={{ fontSize: fontSize ?? '18px', fontWeight: 'bold', color: valColor }}>
        {value}
        <span style={{ fontSize: '11px', color: 'var(--text-dim)', marginLeft: '3px' }}>{unit}</span>
      </div>
    </div>
  );
}
