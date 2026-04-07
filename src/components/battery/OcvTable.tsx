import { X_POS_0, X_POS_100, X_NEG_0, X_NEG_100 } from '../../simulation/constants';
import { U_pos, U_neg } from '../../simulation/ocv';

interface OcvTableProps {
  series: number;
}

const SOC_LEVELS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

export function OcvTable({ series }: OcvTableProps) {
  return (
    <div>
      <div style={{ fontSize: '11px', color: '#fff', textTransform: 'uppercase', letterSpacing: '2px', borderBottom: '1px solid #333', paddingBottom: '5px', marginBottom: '10px' }}>
        OCV Table (SPM stoichiometry)
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', color: '#fff', fontWeight: 'normal', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', padding: '5px 8px', borderBottom: '1px solid #333' }}>SOC</th>
            <th style={{ textAlign: 'right', color: '#fff', fontWeight: 'normal', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', padding: '5px 8px', borderBottom: '1px solid #333' }}>x_pos</th>
            <th style={{ textAlign: 'right', color: '#fff', fontWeight: 'normal', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', padding: '5px 8px', borderBottom: '1px solid #333' }}>x_neg</th>
            <th style={{ textAlign: 'right', color: '#fff', fontWeight: 'normal', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', padding: '5px 8px', borderBottom: '1px solid #333' }}>OCV cell</th>
            <th style={{ textAlign: 'right', color: '#fff', fontWeight: 'normal', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', padding: '5px 8px', borderBottom: '1px solid #333' }}>OCV pack</th>
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
                <td style={{ textAlign: 'right', color: '#4fc3f7', padding: '4px 8px', borderBottom: '1px solid #1a1a1a' }}>{pct}%</td>
                <td style={{ textAlign: 'right', color: '#aaa', padding: '4px 8px', borderBottom: '1px solid #1a1a1a' }}>{xp.toFixed(3)}</td>
                <td style={{ textAlign: 'right', color: '#aaa', padding: '4px 8px', borderBottom: '1px solid #1a1a1a' }}>{xn.toFixed(3)}</td>
                <td style={{ textAlign: 'right', padding: '4px 8px', borderBottom: '1px solid #1a1a1a' }}>{oc.toFixed(4)}</td>
                <td style={{ textAlign: 'right', color: '#ffca28', padding: '4px 8px', borderBottom: '1px solid #1a1a1a' }}>{(oc * series).toFixed(3)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
