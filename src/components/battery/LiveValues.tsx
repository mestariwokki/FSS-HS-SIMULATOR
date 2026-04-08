import { ValueBox } from '../common/ValueBox';
import type { BatteryDataPoint, PackConfig, EcmConfig, SimState } from '../../types';
import { ocvPack } from '../../simulation/ocv';

interface LiveValuesProps {
  data: BatteryDataPoint[];
  pack: PackConfig;
  ecm: EcmConfig;
  simState: SimState;
  duration: number;
}

export function LiveValues({ data, pack, ecm, simState, duration }: LiveValuesProps) {
  const last = data.length > 0 ? data[data.length - 1] : null;
  const soc = simState.soc * 100;
  const voc = last?.v_oc ?? ocvPack(simState.soc, pack.series);
  const vt = last?.v_t ?? voc;
  const i = last?.i_bat ?? 0;
  const p = last?.p_inst ?? 0;
  const tC = last?.T_C ?? 25;

  const pFormatted = Math.abs(p) >= 1000
    ? { val: (p / 1000).toFixed(2), unit: 'kW' }
    : { val: p.toFixed(0), unit: 'W' };

  const cRate = (Math.abs(i) / pack.capacity_Ah).toFixed(2);
  const progress = Math.min(100, simState.t / duration * 100);

  return (
    <div>
      <div style={{ fontSize: '11px', color: '#fff', textTransform: 'uppercase', letterSpacing: '2px', borderBottom: '1px solid #333', paddingBottom: '5px', marginBottom: '10px' }}>
        Pack -- {pack.series}S{pack.parallel}P
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <ValueBox label="SOC" value={soc.toFixed(1)} unit="%" color="blue" infoTerm="SOC" />
        <ValueBox label="V OCV" value={voc.toFixed(2)} unit="V" infoTerm="V_oc" />
        <ValueBox label="V Terminal" value={vt.toFixed(2)} unit="V" color="green" infoTerm="V_batt" />
        <ValueBox label="Current" value={i.toFixed(1)} unit="A" color="red" infoTerm="I_batt" />
        <ValueBox label="Power" value={pFormatted.val} unit={pFormatted.unit} color="yellow" />
        <ValueBox label="C-rate" value={cRate} unit="C" />
        <ValueBox label="T cell" value={tC.toFixed(1)} unit="C" color="orange" infoTerm="T_batt" />
        <ValueBox label="Ah used" value={Math.abs(simState.ah).toFixed(3)} unit="Ah" />
      </div>

      {/* SPM details */}
      {last && (
        <div style={{ marginTop: '10px' }}>
          <div style={{ fontSize: '11px', color: '#fff', textTransform: 'uppercase', letterSpacing: '2px', borderBottom: '1px solid #333', paddingBottom: '5px', marginBottom: '10px', cursor: 'pointer' }}>
            SPM -- Butler-Volmer
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <ValueBox label="x_pos (LiCoO2)" value={last.xp.toFixed(4)} unit="" fontSize="17px" />
            <ValueBox label="x_neg (Graphite)" value={last.xn.toFixed(4)} unit="" fontSize="17px" />
            <ValueBox label="U_pos OCP" value={last.up.toFixed(4)} unit="V" color="yellow" fontSize="17px" />
            <ValueBox label="U_neg OCP" value={last.un.toFixed(4)} unit="V" fontSize="17px" />
            <ValueBox label="eta_pos" value={last.eta_pos.toFixed(1)} unit="mV" color="yellow" fontSize="17px" infoTerm="eta_pos" />
            <ValueBox label="eta_neg" value={last.eta_neg.toFixed(1)} unit="mV" color="green" fontSize="17px" />
          </div>
        </div>
      )}

      {/* SoH values */}
      <div style={{ fontSize: '11px', color: '#fff', textTransform: 'uppercase', letterSpacing: '2px', borderBottom: '1px solid #333', paddingBottom: '5px', marginBottom: '10px', marginTop: '16px' }}>
        SoH -- Aging (2RC ECM)
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <ValueBox label="SOH_cap" value={(ecm.soh_cap * 100).toFixed(1)} unit="%" color="green" infoTerm="SoH_cap" />
        <ValueBox label="SOH_res" value={((1 / ecm.soh_res) * 100).toFixed(1)} unit="%" color="yellow" infoTerm="SoH_res" />
        <ValueBox label="V_RC tot (2RC)" value={(simState.V_RC + simState.V_RC2).toFixed(3)} unit="V" color="purple" fontSize="16px" infoTerm="V_RC" />
        <ValueBox label="Q_eff" value={(pack.capacity_Ah * ecm.soh_cap).toFixed(2)} unit="Ah" fontSize="16px" />
      </div>

      {/* Time */}
      <div style={{ fontSize: '11px', color: '#fff', textTransform: 'uppercase', letterSpacing: '2px', borderBottom: '1px solid #333', paddingBottom: '5px', marginBottom: '10px', marginTop: '16px' }}>
        Run Parameters
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <ValueBox label="Time" value={simState.t.toFixed(1)} unit="s" />
        <ValueBox label="Progress" value={progress.toFixed(0)} unit="%" />
      </div>
    </div>
  );
}
