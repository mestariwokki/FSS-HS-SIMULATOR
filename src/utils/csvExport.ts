import type { BatteryDataPoint, MotorDataPoint } from '../types';

export function exportBatteryCSV(data: BatteryDataPoint[], mode: string, cycles: number): void {
  if (data.length === 0) return;

  const headers = [
    't_s', 'soc_pct', 'voc_V', 'vt_V', 'i_A', 'p_W', 'ah_Ah', 'T_C',
    'eta_pos_mV', 'eta_neg_mV', 'xp', 'xn', 'upos_V', 'uneg_V',
    'vrc1_V', 'vrc2_V', 'soh_cap_pct', 'soh_res_pct', 'q_eff_Ah',
    'wh_out_Wh', 'wh_in_Wh',
  ];

  const rows = data.map(d => [
    d.t.toFixed(3), d.soc.toFixed(3), d.v_oc.toFixed(4), d.v_t.toFixed(4),
    d.i_bat.toFixed(3), d.p_inst.toFixed(2), d.ah.toFixed(5), d.T_C.toFixed(2),
    d.eta_pos.toFixed(3), d.eta_neg.toFixed(3),
    d.xp.toFixed(5), d.xn.toFixed(5), d.up.toFixed(4), d.un.toFixed(4),
    d.vrc.toFixed(5), d.vrc2.toFixed(5),
    d.soh_cap.toFixed(2), d.soh_res.toFixed(2),
    d.q_eff.toFixed(4), d.wh_out.toFixed(4), d.wh_in.toFixed(4),
  ].join(','));

  const csv = [headers.join(','), ...rows].join('\n');
  downloadCSV(csv, `FSO_sim_${mode.toUpperCase()}_N${cycles}_${timestamp()}.csv`);
}

export function exportMotorCSV(data: MotorDataPoint[]): void {
  if (data.length === 0) return;

  const hdr = 't_s,P_mech_kW,P_bat_kW,P_regen_kW,I_bat_A,V_t_V,V_oc_V,soc_pct,T_motor_C,T_esc_C,eta_pct,I_motor_A,RPM,T_wheel_Nm,ah_Ah,wh_out_Wh,wh_regen_Wh,v_kmh';
  const rows = data.map(r => [
    r.t.toFixed(2), r.P_mech_kW.toFixed(3), r.P_bat_kW.toFixed(3), r.P_regen_kW.toFixed(3),
    r.I_bat.toFixed(2), r.V_t.toFixed(3), r.V_oc.toFixed(3), r.soc.toFixed(2),
    r.T_motor.toFixed(2), r.T_esc.toFixed(2), r.eta.toFixed(1), r.I_m.toFixed(2),
    r.RPM.toString(), r.T_wheel.toFixed(2), r.ah.toFixed(4), r.wh_out.toFixed(3),
    r.wh_regen.toFixed(3), (r.v_kmh ?? 0).toFixed(2),
  ].join(','));

  const csv = [hdr, ...rows].join('\n');
  downloadCSV(csv, `FSO_motor_${timestamp()}.csv`);
}

function timestamp(): string {
  const now = new Date();
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
}

function downloadCSV(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
