import type { BatteryDataPoint, PackConfig } from '../../types';

interface AlertBarProps {
  data: BatteryDataPoint[];
  pack: PackConfig;
  ocLimit: number;
  tLimit: number;
}

function Alert({ on, label, type }: { on: boolean; label: string; type: 'ov' | 'uv' | 'oc' | 'hot' }) {
  const colors: Record<string, { color: string; border: string; bg: string }> = {
    ov: { color: '#ef5350', border: '#5a1a1a', bg: '#1e1212' },
    uv: { color: '#ef5350', border: '#5a1a1a', bg: '#1e1212' },
    oc: { color: '#ffca28', border: '#555010', bg: '#1e1c10' },
    hot: { color: '#ffa726', border: '#553010', bg: '#1e1508' },
  };
  const c = on ? colors[type] : { color: '#3a3a50', border: '#1a1a24', bg: '#0d0d14' };

  return (
    <div style={{
      fontSize: '11px',
      padding: '3px 9px',
      border: `1px solid ${c.border}`,
      color: c.color,
      background: c.bg,
    }}>
      {label}
    </div>
  );
}

export function AlertBar({ data, pack, ocLimit, tLimit }: AlertBarProps) {
  const last = data.length > 0 ? data[data.length - 1] : null;
  const vt = last?.v_t ?? 0;
  const i = last?.i_bat ?? 0;
  const temp = last?.T_C ?? 25;

  return (
    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
      <Alert on={vt > pack.v_max * 0.99} label={`OV (>${pack.v_max.toFixed(2)}V)`} type="ov" />
      <Alert on={vt > 0 && vt < pack.v_min + 0.5} label={`UV (<${pack.v_min.toFixed(2)}V)`} type="uv" />
      <Alert on={i > ocLimit} label={`OC (>${ocLimit}A)`} type="oc" />
      <Alert on={temp > tLimit} label={`HOT (>${tLimit}C)`} type="hot" />
    </div>
  );
}
