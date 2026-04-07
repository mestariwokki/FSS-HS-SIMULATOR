import { ParamGroup } from '../common/ParamGroup';

interface MotorConfigPanelProps {
  kV: number;
  setKV: (v: number) => void;
  Rw: number;
  setRw: (v: number) => void;
  gear: number;
  setGear: (v: number) => void;
  wheelD: number;
  setWheelD: (v: number) => void;
  pCont: number;
  setPCont: (v: number) => void;
  pPeak: number;
  setPPeak: (v: number) => void;
  iCont: number;
  setICont: (v: number) => void;
  iPeak: number;
  setIPeak: (v: number) => void;
  nMotors: number;
  setNMotors: (v: number) => void;
  etaEsc: number;
  setEtaEsc: (v: number) => void;
  etaRegen: number;
  setEtaRegen: (v: number) => void;
  etaMotor: number;
  setEtaMotor: (v: number) => void;
}

export function MotorConfigPanel(props: MotorConfigPanelProps) {
  return (
    <div>
      <div style={{ fontSize: '11px', color: '#fff', textTransform: 'uppercase', letterSpacing: '2px', borderBottom: '1px solid #333', paddingBottom: '5px', marginBottom: '10px' }}>
        Motor / Drivetrain
      </div>
      <ParamGroup label="kV" value={props.kV} onChange={props.setKV} min={10} max={2000} step={1} unit="RPM/V" />
      <ParamGroup label="R_winding" value={props.Rw} onChange={props.setRw} min={0.001} max={2} step={0.01} unit="Ohm" />
      <ParamGroup label="Gear ratio" value={props.gear} onChange={props.setGear} min={1} max={20} step={0.1} unit=":1" />
      <ParamGroup label="Wheel dia" value={props.wheelD} onChange={props.setWheelD} min={200} max={700} step={10} unit="mm" />
      <ParamGroup label="P_cont" value={props.pCont} onChange={props.setPCont} min={0.5} max={50} step={0.5} unit="kW" />
      <ParamGroup label="P_peak" value={props.pPeak} onChange={props.setPPeak} min={0.5} max={50} step={0.5} unit="kW" />
      <ParamGroup label="I_cont" value={props.iCont} onChange={props.setICont} min={10} max={500} step={1} unit="A" />
      <ParamGroup label="I_peak" value={props.iPeak} onChange={props.setIPeak} min={10} max={500} step={1} unit="A" />
      <ParamGroup label="n_motors" value={props.nMotors} onChange={props.setNMotors} min={1} max={4} step={1} unit="" />
      <ParamGroup label="eta_ESC" value={props.etaEsc} onChange={props.setEtaEsc} min={0.8} max={1.0} step={0.01} unit="" />
      <ParamGroup label="eta_regen" value={props.etaRegen} onChange={props.setEtaRegen} min={0.5} max={1.0} step={0.01} unit="" />
      <ParamGroup label="eta_motor" value={props.etaMotor} onChange={props.setEtaMotor} min={0.7} max={1.0} step={0.01} unit="" />
    </div>
  );
}
