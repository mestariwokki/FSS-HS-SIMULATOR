import { useState } from 'react';
import type { PackConfig, EcmConfig } from '../../types';
import { calcShortCircuit } from '../../simulation/shortCircuit';

interface ShortCircuitPanelProps {
  pack: PackConfig;
  ecm: EcmConfig;
}

export function ShortCircuitPanel({ pack, ecm }: ShortCircuitPanelProps) {
  const [open, setOpen] = useState(false);
  const sc = calcShortCircuit(pack, ecm);

  return (
    <div style={{ marginTop: '20px' }}>
      <div
        onClick={() => setOpen(!open)}
        style={{
          fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '2px',
          borderBottom: '1px solid var(--border-dim)', paddingBottom: '5px', display: 'flex',
          justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer',
        }}
      >
        Short Circuit Calculator
        <span style={{ color: 'var(--text-faint)', fontSize: '11px', fontWeight: 'normal', letterSpacing: '1px' }}>
          {open ? 'hide' : 'show'}
        </span>
      </div>

      {open && (
        <div style={{ marginTop: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '10px', lineHeight: 1.8 }}>
              Short circuit current from OCV and pack resistance:<br />
              <span style={{ color: 'var(--accent-em)' }}>I_sc = V_OCV_pack / R_pack_eff</span>
            </div>
            <table style={{ fontSize: '13px' }}>
              <tbody>
                <tr><td style={{ color: 'var(--text-secondary)' }}>V_max pack</td><td style={{ textAlign: 'right', color: 'var(--accent-em)' }}>{sc.v_max_pack.toFixed(2)} V</td></tr>
                <tr><td style={{ color: 'var(--text-secondary)' }}>V_nom pack</td><td style={{ textAlign: 'right', color: 'var(--text-primary)' }}>{sc.v_nom_pack.toFixed(2)} V</td></tr>
                <tr><td style={{ color: 'var(--text-secondary)' }}>R_pack (new)</td><td style={{ textAlign: 'right', color: '#ffca28' }}>{(sc.R_pack_new * 1000).toFixed(1)} mOhm</td></tr>
                <tr><td style={{ color: 'var(--text-secondary)' }}>R_pack_eff (SoH)</td><td style={{ textAlign: 'right', color: 'var(--accent-ice)' }}>{(sc.R_pack_eff * 1000).toFixed(1)} mOhm</td></tr>
                <tr><td style={{ color: 'var(--text-secondary)' }}>I_sc max (SOC 100%)</td><td style={{ textAlign: 'right', color: 'var(--accent-alert)', fontWeight: 'bold' }}>{sc.I_sc_max.toFixed(0)} A</td></tr>
                <tr><td style={{ color: 'var(--text-secondary)' }}>P_max (SOC 100%)</td><td style={{ textAlign: 'right', color: 'var(--accent-battery)' }}>{(sc.P_sc_max / 1000).toFixed(1)} kW</td></tr>
              </tbody>
            </table>
          </div>

          <div>
            <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '2px', borderBottom: '1px solid var(--border-dim)', paddingBottom: '5px', marginBottom: '8px' }}>
              I_sc at different SOC levels
            </div>
            <table style={{ fontSize: '13px', width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ color: 'var(--text-secondary)', fontSize: '12px', textAlign: 'left' }}>SOC</th>
                  <th style={{ color: 'var(--text-secondary)', fontSize: '12px', textAlign: 'right' }}>V_OCV</th>
                  <th style={{ color: 'var(--text-secondary)', fontSize: '12px', textAlign: 'right' }}>I_sc</th>
                  <th style={{ color: 'var(--text-secondary)', fontSize: '12px', textAlign: 'right' }}>P_sc</th>
                </tr>
              </thead>
              <tbody>
                {sc.socLevels.map(level => {
                  const col = level.soc >= 0.7 ? 'var(--accent-alert)' : level.soc >= 0.4 ? '#ffca28' : 'var(--text-dim)';
                  return (
                    <tr key={level.soc}>
                      <td style={{ color: 'var(--text-secondary)' }}>{(level.soc * 100).toFixed(0)}%</td>
                      <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{level.v_oc_pack.toFixed(2)} V</td>
                      <td style={{ textAlign: 'right', color: col, fontWeight: 'bold' }}>{level.I_sc.toFixed(0)} A</td>
                      <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{level.P_sc.toFixed(1)} kW</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
