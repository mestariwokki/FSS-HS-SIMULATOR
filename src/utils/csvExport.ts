import type { BatteryDataPoint, MotorDataPoint } from '../types';
import type { HybridPoint } from '../simulation/motor/hybridStep';

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

export function exportHybridCSV(data: HybridPoint[], mode: string): void {
  if (data.length === 0) return;

  const hdr = 't_s,v_kmh,a_ms2,x_m,P_demand_kW,P_em_kW,P_ice_kW,P_total_kW,T_em_Nm,T_ice_Nm,T_total_Nm,RPM_wheel,RPM_ice,N_f_N,N_r_N,soc_pct,I_bat_A,V_bat_V,wh_em_Wh,fuel_g,eta_sys_pct,T_BLDC1_C,T_BLDC2_C,T_ESC1_C,T_ESC2_C,T_ice_C,eta_ice_pct';
  const rows = data.map(r => [
    r.t.toFixed(3), r.v_kmh.toFixed(2), r.a_ms2.toFixed(3), r.x_m.toFixed(2),
    r.P_demand_kW.toFixed(3), r.P_em_kW.toFixed(3), r.P_ice_kW.toFixed(3), r.P_total_kW.toFixed(3),
    r.T_em_Nm.toFixed(2), r.T_ice_Nm.toFixed(2), r.T_total_Nm.toFixed(2),
    r.RPM_wheel.toFixed(0), r.RPM_ice.toFixed(0),
    r.N_f.toFixed(1), r.N_r.toFixed(1),
    r.soc.toFixed(2), r.I_bat.toFixed(2), r.V_bat.toFixed(3),
    r.wh_em.toFixed(3), r.fuel_g.toFixed(3),
    r.eta_sys.toFixed(1),
    r.T_BLDC1.toFixed(1), r.T_BLDC2.toFixed(1), r.T_ESC1.toFixed(1), r.T_ESC2.toFixed(1),
    r.T_ice_C.toFixed(1), (r.eta_ice * 100).toFixed(1),
  ].join(','));

  const csv = [hdr, ...rows].join('\n');
  downloadCSV(csv, `FSO_hybrid_${mode.toUpperCase()}_${timestamp()}.csv`);
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
