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
          fontSize: '11px', color: '#fff', textTransform: 'uppercase', letterSpacing: '2px',
          borderBottom: '1px solid #333', paddingBottom: '5px', display: 'flex',
          justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer',
        }}
      >
        Short Circuit Calculator
        <span style={{ color: '#aaa', fontSize: '11px', fontWeight: 'normal', letterSpacing: '1px' }}>
          {open ? 'hide' : 'show'}
        </span>
      </div>

      {open && (
        <div style={{ marginTop: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div>
            <div style={{ fontSize: '13px', color: '#ccc', marginBottom: '10px', lineHeight: 1.8 }}>
              Short circuit current from OCV and pack resistance:<br />
              <span style={{ fontFamily: "'Courier New', monospace", color: '#4db6ac' }}>I_sc = V_OCV_pack / R_pack_eff</span>
            </div>
            <table style={{ fontSize: '13px' }}>
              <tbody>
                <tr><td style={{ color: '#ddd' }}>V_max pack</td><td style={{ textAlign: 'right', color: '#4fc3f7' }}>{sc.v_max_pack.toFixed(2)} V</td></tr>
                <tr><td style={{ color: '#ddd' }}>V_nom pack</td><td style={{ textAlign: 'right' }}>{sc.v_nom_pack.toFixed(2)} V</td></tr>
                <tr><td style={{ color: '#ddd' }}>R_pack (new)</td><td style={{ textAlign: 'right', color: '#ffca28' }}>{(sc.R_pack_new * 1000).toFixed(1)} mOhm</td></tr>
                <tr><td style={{ color: '#ddd' }}>R_pack_eff (SoH)</td><td style={{ textAlign: 'right', color: '#ffa726' }}>{(sc.R_pack_eff * 1000).toFixed(1)} mOhm</td></tr>
                <tr><td style={{ color: '#ddd' }}>I_sc max (SOC 100%)</td><td style={{ textAlign: 'right', color: '#ef5350', fontWeight: 'bold' }}>{sc.I_sc_max.toFixed(0)} A</td></tr>
                <tr><td style={{ color: '#ddd' }}>P_max (SOC 100%)</td><td style={{ textAlign: 'right', color: '#ce93d8' }}>{(sc.P_sc_max / 1000).toFixed(1)} kW</td></tr>
              </tbody>
            </table>
          </div>

          <div>
            <div style={{ fontSize: '11px', color: '#fff', textTransform: 'uppercase', letterSpacing: '2px', borderBottom: '1px solid #333', paddingBottom: '5px', marginBottom: '8px' }}>
              I_sc at different SOC levels
            </div>
            <table style={{ fontSize: '13px', width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ color: '#fff', fontSize: '12px', textAlign: 'left' }}>SOC</th>
                  <th style={{ color: '#fff', fontSize: '12px', textAlign: 'right' }}>V_OCV</th>
                  <th style={{ color: '#fff', fontSize: '12px', textAlign: 'right' }}>I_sc</th>
                  <th style={{ color: '#fff', fontSize: '12px', textAlign: 'right' }}>P_sc</th>
                </tr>
              </thead>
              <tbody>
                {sc.socLevels.map(level => {
                  const col = level.soc >= 0.7 ? '#ef5350' : level.soc >= 0.4 ? '#ffca28' : '#aaa';
                  return (
                    <tr key={level.soc}>
                      <td style={{ color: '#ddd' }}>{(level.soc * 100).toFixed(0)}%</td>
                      <td style={{ textAlign: 'right', color: '#ccc' }}>{level.v_oc_pack.toFixed(2)} V</td>
                      <td style={{ textAlign: 'right', color: col, fontWeight: 'bold' }}>{level.I_sc.toFixed(0)} A</td>
                      <td style={{ textAlign: 'right', color: '#ccc' }}>{level.P_sc.toFixed(1)} kW</td>
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
