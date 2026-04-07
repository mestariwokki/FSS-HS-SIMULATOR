interface Acc75ResultBoxProps {
  result: {
    t_75: number | null;
    v_75: number | null;
    trac_switch_t: number | null;
    trac_switch_v: number | null;
  } | null;
}

export function Acc75ResultBox({ result }: Acc75ResultBoxProps) {
  if (!result) return null;

  const t75 = result.t_75;
  const v75 = result.v_75;

  return (
    <div style={{
      background: '#111',
      border: '2px solid #66bb6a',
      padding: '16px 20px',
      marginBottom: '14px',
    }}>
      <div style={{ fontSize: '11px', color: '#66bb6a', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '8px' }}>
        75 m Acceleration Result
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div>
          <div style={{ fontSize: '10px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '1px' }}>Time</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#66bb6a' }}>
            {t75 !== null ? t75.toFixed(3) : '--'}
            <span style={{ fontSize: '12px', color: '#888', marginLeft: '4px' }}>s</span>
          </div>
        </div>
        <div>
          <div style={{ fontSize: '10px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '1px' }}>Exit Speed</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#4fc3f7' }}>
            {v75 !== null ? v75.toFixed(1) : '--'}
            <span style={{ fontSize: '12px', color: '#888', marginLeft: '4px' }}>km/h</span>
          </div>
        </div>
      </div>
      {result.trac_switch_t !== null && (
        <div style={{ marginTop: '10px', fontSize: '12px', color: '#888' }}>
          Traction limit released at {result.trac_switch_t.toFixed(2)}s / {result.trac_switch_v?.toFixed(1)} km/h
        </div>
      )}
    </div>
  );
}
