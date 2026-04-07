import { ParamGroup } from '../common/ParamGroup';

interface Acc75PanelProps {
  massAcc: number;
  setMassAcc: (v: number) => void;
  CrrAcc: number;
  setCrrAcc: (v: number) => void;
  mu: number;
  setMu: (v: number) => void;
  fFront: number;
  setFFront: (v: number) => void;
  hCg: number;
  setHCg: (v: number) => void;
  wheelbase: number;
  setWheelbase: (v: number) => void;
}

export function Acc75Panel(props: Acc75PanelProps) {
  return (
    <div>
      <div style={{ fontSize: '11px', color: '#fff', textTransform: 'uppercase', letterSpacing: '2px', borderBottom: '1px solid #333', paddingBottom: '5px', marginBottom: '10px' }}>
        75 m Accel Parameters
      </div>
      <ParamGroup label="Mass (accel)" value={props.massAcc} onChange={props.setMassAcc} min={100} max={600} step={5} unit="kg" />
      <ParamGroup label="Crr (accel)" value={props.CrrAcc} onChange={props.setCrrAcc} min={0.005} max={0.05} step={0.001} unit="" />
      <ParamGroup label="mu (grip)" value={props.mu} onChange={props.setMu} min={0.5} max={3.0} step={0.05} unit="" />
      <ParamGroup label="f_front" value={props.fFront} onChange={props.setFFront} min={0.3} max={0.7} step={0.01} unit="" />
      <ParamGroup label="h_cg" value={props.hCg} onChange={props.setHCg} min={0.15} max={0.6} step={0.01} unit="m" />
      <ParamGroup label="Wheelbase" value={props.wheelbase} onChange={props.setWheelbase} min={1.0} max={2.5} step={0.05} unit="m" />
    </div>
  );
}
