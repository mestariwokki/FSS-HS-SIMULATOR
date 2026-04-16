import { X_POS_0, X_POS_100, X_NEG_0, X_NEG_100 } from '../../simulation/constants';
import { U_pos, U_neg } from '../../simulation/ocv';

interface OcvTableProps {
  series: number;
}

const SOC_LEVELS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

export function OcvTable({ series }: OcvTableProps) {
  return (
    <div>
      <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '2px', borderBottom: '1px solid var(--border-dim)', paddingBottom: '5px', marginBottom: '10px' }}>
        OCV Table (SPM stoichiometry)
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 'normal', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', padding: '5px 8px', borderBottom: '1px solid var(--border-dim)' }}>SOC</th>
            <th style={{ textAlign: 'right', color: 'var(--text-secondary)', fontWeight: 'normal', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', padding: '5px 8px', borderBottom: '1px solid var(--border-dim)' }}>x_pos</th>
            <th style={{ textAlign: 'right', color: 'var(--text-secondary)', fontWeight: 'normal', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', padding: '5px 8px', borderBottom: '1px solid var(--border-dim)' }}>x_neg</th>
            <th style={{ textAlign: 'right', color: 'var(--text-secondary)', fontWeight: 'normal', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', padding: '5px 8px', borderBottom: '1px solid var(--border-dim)' }}>OCV cell</th>
            <th style={{ textAlign: 'right', color: 'var(--text-secondary)', fontWeight: 'normal', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', padding: '5px 8px', borderBottom: '1px solid var(--border-dim)' }}>OCV pack</th>
          </tr>
        </thead>
        <tbody>
          {SOC_LEVELS.map(pct => {
            const s = pct / 100;
            const xp = X_POS_0 + (X_POS_100 - X_POS_0) * s;
            const xn = X_NEG_0 + (X_NEG_100 - X_NEG_0) * s;
            const up = U_pos(xp);
            const un = U_neg(xn);
            const oc = up - un;
            const bold = [0, 30, 60, 100].includes(pct);
            return (
              <tr key={pct} style={{ fontWeight: bold ? 'bold' : 'normal' }}>
                <td style={{ textAlign: 'right', color: 'var(--accent-em)', padding: '4px 8px', borderBottom: '1px solid var(--border-dim)' }}>{pct}%</td>
                <td style={{ textAlign: 'right', color: 'var(--text-dim)', padding: '4px 8px', borderBottom: '1px solid var(--border-dim)' }}>{xp.toFixed(3)}</td>
                <td style={{ textAlign: 'right', color: 'var(--text-dim)', padding: '4px 8px', borderBottom: '1px solid var(--border-dim)' }}>{xn.toFixed(3)}</td>
                <td style={{ textAlign: 'right', color: 'var(--text-secondary)', padding: '4px 8px', borderBottom: '1px solid var(--border-dim)' }}>{oc.toFixed(4)}</td>
                <td style={{ textAlign: 'right', color: '#ffca28', padding: '4px 8px', borderBottom: '1px solid var(--border-dim)' }}>{(oc * series).toFixed(3)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
