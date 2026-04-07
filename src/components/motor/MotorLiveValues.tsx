import type { MotorDataPoint } from '../../types';
import { ValueBox } from '../common/ValueBox';

interface MotorLiveValuesProps {
  data: MotorDataPoint[];
}

export function MotorLiveValues({ data }: MotorLiveValuesProps) {
  const last = data.length > 0 ? data[data.length - 1] : null;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '8px', marginBottom: '14px' }}>
      <ValueBox label="Time" value={last ? last.t.toFixed(1) : '--'} unit="s" color="blue" />
      <ValueBox label="SOC" value={last ? last.soc.toFixed(1) : '--'} unit="%" color="green" />
      <ValueBox label="V_bat" value={last ? last.V_t.toFixed(2) : '--'} unit="V" color="yellow" />
      <ValueBox label="I_bat" value={last ? last.I_bat.toFixed(1) : '--'} unit="A" color="red" />
      <ValueBox label="P_mech" value={last ? last.P_mech_kW.toFixed(2) : '--'} unit="kW" color="purple" />
      <ValueBox label="P_bat" value={last ? last.P_bat_kW.toFixed(2) : '--'} unit="kW" color="orange" />
      <ValueBox label="RPM" value={last ? last.RPM.toFixed(0) : '--'} unit="" color="blue" />
      <ValueBox label="Speed" value={last ? last.v_kmh.toFixed(1) : '--'} unit="km/h" color="green" />
      <ValueBox label="T_motor" value={last ? last.T_motor.toFixed(1) : '--'} unit="C" color="red" />
      <ValueBox label="T_esc" value={last ? last.T_esc.toFixed(1) : '--'} unit="C" color="orange" />
      <ValueBox label="eta" value={last ? last.eta.toFixed(1) : '--'} unit="%" color="green" />
      <ValueBox label="Ah" value={last ? last.ah.toFixed(2) : '--'} unit="Ah" color="yellow" />
    </div>
  );
}
