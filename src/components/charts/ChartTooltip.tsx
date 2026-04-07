interface TooltipRow {
  label: string;
  value: string;
  color?: string;
}

interface ChartTooltipProps {
  visible: boolean;
  x: number;
  y: number;
  title: string;
  rows: TooltipRow[];
}

export function ChartTooltip({ visible, x, y, title, rows }: ChartTooltipProps) {
  if (!visible) return null;

  // Keep tooltip on screen
  let lx = x + 18;
  let ly = y - 60;
  if (lx + 200 > window.innerWidth - 8) lx = x - 210;
  if (ly < 8) ly = 8;

  return (
    <div style={{
      position: 'fixed',
      left: lx,
      top: ly,
      pointerEvents: 'none',
      background: 'rgba(8,8,8,0.95)',
      border: '1px solid #555',
      padding: '9px 13px',
      fontSize: '11px',
      fontFamily: "'Courier New', monospace",
      color: '#fff',
      whiteSpace: 'nowrap',
      zIndex: 999,
      lineHeight: 1.8,
      minWidth: '165px',
      boxShadow: '0 2px 12px rgba(0,0,0,0.6)',
    }}>
      <div style={{ color: '#bbb', fontSize: '10px', marginBottom: '3px', letterSpacing: '1px' }}>{title}</div>
      {rows.map((row, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: '18px' }}>
          <span style={{ color: '#ccc' }}>{row.label}</span>
          <span style={{ fontWeight: 'bold', color: row.color ?? '#fff' }}>{row.value}</span>
        </div>
      ))}
    </div>
  );
}
