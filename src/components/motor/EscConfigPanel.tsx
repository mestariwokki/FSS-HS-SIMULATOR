import { ParamGroup } from '../common/ParamGroup';

interface EscConfigPanelProps {
  mCpMotor: number;
  setMCpMotor: (v: number) => void;
  rThMotor: number;
  setRThMotor: (v: number) => void;
  mCpEsc: number;
  setMCpEsc: (v: number) => void;
  rThEsc: number;
  setRThEsc: (v: number) => void;
  tAmb: number;
  setTAmb: (v: number) => void;
}

export function EscConfigPanel(props: EscConfigPanelProps) {
  return (
    <div>
      <div style={{ fontSize: '11px', color: '#fff', textTransform: 'uppercase', letterSpacing: '2px', borderBottom: '1px solid #333', paddingBottom: '5px', marginBottom: '10px' }}>
        Thermal Model
      </div>
      <ParamGroup label="mCp motor" value={props.mCpMotor} onChange={props.setMCpMotor} min={50} max={5000} step={50} unit="J/K" />
      <ParamGroup label="R_th motor" value={props.rThMotor} onChange={props.setRThMotor} min={0.1} max={5} step={0.1} unit="K/W" />
      <ParamGroup label="mCp ESC" value={props.mCpEsc} onChange={props.setMCpEsc} min={50} max={2000} step={50} unit="J/K" />
      <ParamGroup label="R_th ESC" value={props.rThEsc} onChange={props.setRThEsc} min={0.1} max={5} step={0.1} unit="K/W" />
      <ParamGroup label="T_ambient" value={props.tAmb} onChange={props.setTAmb} min={-10} max={50} step={1} unit="C" />
    </div>
  );
}
