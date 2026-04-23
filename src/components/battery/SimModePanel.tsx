import type { SimMode, ProfileStep } from '../../types';
import { ParamGroup } from '../common/ParamGroup';
import { NumericInput } from '../common/NumericInput';

interface SimModePanelProps {
  mode: SimMode;
  onModeChange: (mode: SimMode) => void;
  current: number;
  duration: number;
  onCurrentChange: (v: number) => void;
  onDurationChange: (v: number) => void;
  profileSteps: ProfileStep[];
  onProfileChange: (steps: ProfileStep[]) => void;
  chargeCurrent: number;
  chargeCutoff: number;
  chargeDuration: number;
  onChargeCurrentChange: (v: number) => void;
  onChargeCutoffChange: (v: number) => void;
  onChargeDurationChange: (v: number) => void;
  ocLimit: number;
  tLimit: number;
  onOcLimitChange: (v: number) => void;
  onTLimitChange: (v: number) => void;
  t0: number;
  soc0: number;
  onT0Change: (v: number) => void;
  onSoc0Change: (v: number) => void;
}

const MODE_LABELS: Record<SimMode, string> = {
  const: 'Constant',
  profile: 'Profile',
  charge: 'Charge',
};

export function SimModePanel(props: SimModePanelProps) {
  const { mode, onModeChange, profileSteps, onProfileChange } = props;

  const totalDuration = profileSteps.reduce((s, step) => s + step.duration_s, 0);

  return (
    <div>
      <div style={{ fontSize: '10px', color: '#ccc', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '10px', paddingBottom: '5px', borderBottom: '1px solid #2a2a2a' }}>
        Simulation
      </div>

      {/* Mode buttons */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '10px' }}>
        {(['const', 'profile', 'charge'] as SimMode[]).map(m => (
          <button
            key={m}
            onClick={() => onModeChange(m)}
            style={{
              flex: 1, padding: '5px 4px',
              fontFamily: "'Courier New', monospace", fontSize: '10px',
              textTransform: 'uppercase', letterSpacing: '1px',
              background: mode === m ? (m === 'charge' ? '#0f1a0f' : '#1a1a2a') : '#0f0f14',
              border: `1px solid ${mode === m ? (m === 'charge' ? '#66bb6a' : '#4fc3f7') : '#2d2d38'}`,
              color: mode === m ? (m === 'charge' ? '#66bb6a' : '#4fc3f7') : '#aaa',
              cursor: 'pointer', borderRadius: '2px',
            }}
          >
            {MODE_LABELS[m]}
          </button>
        ))}
      </div>

      {/* Constant current */}
      {mode === 'const' && (
        <div>
          <ParamGroup label="Discharge I" value={props.current} onChange={props.onCurrentChange} min={1} max={600} step={1} unit="A" />
          <ParamGroup label="Duration" value={props.duration} onChange={props.onDurationChange} min={1} max={7200} step={1} unit="s" />
        </div>
      )}

      {/* Profile */}
      {mode === 'profile' && (
        <div>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '4px' }}>
            <thead>
              <tr>
                <th style={{ fontFamily: "'Courier New', monospace", fontSize: '9px', color: '#bbb', textTransform: 'uppercase', letterSpacing: '1px', padding: '3px 4px', textAlign: 'left', borderBottom: '1px solid #222' }}>Duration (s)</th>
                <th style={{ fontFamily: "'Courier New', monospace", fontSize: '9px', color: '#bbb', textTransform: 'uppercase', letterSpacing: '1px', padding: '3px 4px', textAlign: 'left', borderBottom: '1px solid #222' }}>Current (A)</th>
                <th style={{ width: '20px' }}></th>
              </tr>
            </thead>
            <tbody>
              {profileSteps.map((step, i) => (
                <tr key={i}>
                  <td style={{ padding: '2px' }}>
                    <NumericInput
                      value={step.duration_s}
                      onChange={v => {
                        const newSteps = [...profileSteps];
                        newSteps[i] = { ...step, duration_s: v };
                        onProfileChange(newSteps);
                      }}
                      min={1} max={3600} step={1}
                      style={{
                        width: '100%', background: '#0a0a0a', border: '1px solid #252530',
                        color: '#e0e0e0', fontFamily: "'Courier New', monospace", fontSize: '12px',
                        padding: '3px 5px', borderRadius: '2px',
                      }}
                    />
                  </td>
                  <td style={{ padding: '2px' }}>
                    <NumericInput
                      value={step.current_A}
                      onChange={v => {
                        const newSteps = [...profileSteps];
                        newSteps[i] = { ...step, current_A: v };
                        onProfileChange(newSteps);
                      }}
                      min={-200} max={600} step={1}
                      style={{
                        width: '100%', background: '#0a0a0a', border: '1px solid #252530',
                        color: step.current_A < 0 ? '#66bb6a' : '#e0e0e0',
                        fontFamily: "'Courier New', monospace", fontSize: '12px',
                        padding: '3px 5px', borderRadius: '2px',
                      }}
                    />
                  </td>
                  <td>
                    {profileSteps.length > 1 && (
                      <button
                        onClick={() => onProfileChange(profileSteps.filter((_, j) => j !== i))}
                        style={{ background: 'none', border: 'none', color: '#444', cursor: 'pointer', fontSize: '14px', padding: '0 4px' }}
                      >x</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            onClick={() => onProfileChange([...profileSteps, { duration_s: 60, current_A: 50 }])}
            style={{
              width: '100%', marginTop: '4px', padding: '4px', background: '#0a0a0a',
              border: '1px dashed #2d2d38', color: '#555', fontFamily: "'Courier New', monospace",
              fontSize: '10px', cursor: 'pointer', borderRadius: '2px', letterSpacing: '1px',
            }}
          >+ add step</button>
          <div style={{ fontFamily: "'Courier New', monospace", fontSize: '10px', color: '#bbb', marginTop: '4px', textAlign: 'right' }}>
            Total: {totalDuration} s
          </div>
        </div>
      )}

      {/* Charge CC-CV */}
      {mode === 'charge' && (
        <div>
          <ParamGroup label="CC current" value={props.chargeCurrent} onChange={props.onChargeCurrentChange} min={1} max={200} step={1} unit="A" />
          <ParamGroup label="Cutoff I" value={props.chargeCutoff} onChange={props.onChargeCutoffChange} min={0.1} max={20} step={0.1} unit="A" />
          <ParamGroup label="Max time" value={props.chargeDuration} onChange={props.onChargeDurationChange} min={60} max={14400} step={60} unit="s" />
          <div style={{ fontFamily: "'Courier New', monospace", fontSize: '10px', color: '#666', marginTop: '6px', lineHeight: 1.5 }}>
            CC: constant current until V &ge; V_max<br />
            CV: current decays, stop when I &lt; cutoff
          </div>
        </div>
      )}

      {/* Limits */}
      <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #1e1e1e' }}>
        <div style={{ fontSize: '9px', color: '#fff', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '6px' }}>Warning limits</div>
        <ParamGroup label="Overcurrent" value={props.ocLimit} onChange={props.onOcLimitChange} min={1} max={600} step={1} unit="A" />
        <ParamGroup label="Overtemp" value={props.tLimit} onChange={props.onTLimitChange} min={30} max={90} step={1} unit="C" />
      </div>

      {/* Initial conditions */}
      <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #1e1e1e' }}>
        <div style={{ fontSize: '9px', color: '#fff', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '6px' }}>Initial conditions</div>
        <ParamGroup label="Temperature" value={props.t0} onChange={props.onT0Change} min={-20} max={60} step={1} unit="C" />
        <ParamGroup label="Initial SOC" value={props.soc0} onChange={props.onSoc0Change} min={10} max={100} step={5} unit="%" />
      </div>
    </div>
  );
}
