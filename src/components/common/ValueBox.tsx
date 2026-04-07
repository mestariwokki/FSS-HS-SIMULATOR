interface ValueBoxProps {
  label: string;
  value: string;
  unit: string;
  color?: 'blue' | 'green' | 'red' | 'yellow' | 'purple' | 'orange';
  tooltip?: string;
  fontSize?: string;
}

const COLOR_MAP: Record<string, string> = {
  blue: '#4fc3f7',
  green: '#66bb6a',
  red: '#ef5350',
  yellow: '#ffca28',
  purple: '#ce93d8',
  orange: '#ffa726',
};

export function ValueBox({ label, value, unit, color, tooltip, fontSize }: ValueBoxProps) {
  const valColor = color ? COLOR_MAP[color] : '#ddd';
  return (
    <div
      className="vbox"
      title={tooltip}
      style={{
        background: '#1a1a1a',
        border: '1px solid #222',
        padding: '9px 12px',
        cursor: tooltip ? 'help' : undefined,
      }}
    >
      <div style={{ fontSize: '10px', color: '#ccc', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '3px' }}>
        {label}
      </div>
      <div style={{ fontSize: fontSize ?? '20px', fontWeight: 'bold', color: valColor }}>
        {value}
        <span style={{ fontSize: '11px', color: '#aaa', marginLeft: '2px' }}>{unit}</span>
      </div>
    </div>
  );
}
