import type { MotorDataPoint, MotorSimStats } from '../../types';

interface MotorSummaryTableProps {
  data: MotorDataPoint[];
  stats: MotorSimStats;
}

export function MotorSummaryTable({ data, stats }: MotorSummaryTableProps) {
  if (data.length === 0) return null;

  const last = data[data.length - 1];
  const avgEta = stats.eta_n > 0 ? (stats.eta_sum / stats.eta_n * 100).toFixed(1) : '--';

  const rows: [string, string, string][] = [
    ['Duration', last.t.toFixed(1), 's'],
    ['Wh discharged', last.wh_out.toFixed(1), 'Wh'],
    ['Wh regen', last.wh_regen.toFixed(1), 'Wh'],
    ['Ah total', last.ah.toFixed(2), 'Ah'],
    ['SOC final', last.soc.toFixed(1), '%'],
    ['Max I_bat', stats.max_I_bat.toFixed(1), 'A'],
    ['Min V_bat', stats.min_Vt.toFixed(2), 'V'],
    ['Max T_motor', stats.max_T_m.toFixed(1), 'C'],
    ['Max T_esc', stats.max_T_e.toFixed(1), 'C'],
    ['Avg eta', avgEta, '%'],
  ];

  if (stats.t_target !== null) {
    rows.push(['t_target', stats.t_target.toFixed(2), 's']);
  }

  return (
    <div style={{ marginTop: '16px' }}>
      <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '2px', borderBottom: '1px solid var(--border-dim)', paddingBottom: '5px', marginBottom: '8px' }}>
        Summary
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <tbody>
          {rows.map(([label, value, unit]) => (
            <tr key={label}>
              <td style={{ color: 'var(--text-secondary)', padding: '3px 8px', borderBottom: '1px solid var(--border-dim)' }}>{label}</td>
              <td style={{ textAlign: 'right', color: 'var(--accent-em)', padding: '3px 8px', borderBottom: '1px solid var(--border-dim)' }}>{value}</td>
              <td style={{ color: 'var(--text-dim)', padding: '3px 8px', borderBottom: '1px solid var(--border-dim)', fontSize: '11px' }}>{unit}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
