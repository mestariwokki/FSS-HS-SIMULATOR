import type { PackConfig, EcmConfig } from '../types';
import { ocvPack } from './ocv';

export interface ShortCircuitResult {
  v_max_pack: number;
  v_nom_pack: number;
  R_pack_new: number;
  R_pack_eff: number;
  I_sc_max: number;
  P_sc_max: number;
  socLevels: Array<{
    soc: number;
    v_oc_pack: number;
    I_sc: number;
    P_sc: number;
  }>;
}

export function calcShortCircuit(
  pack: PackConfig,
  ecm: EcmConfig,
): ShortCircuitResult {
  const R_eff = pack.resistance_Ohm * ecm.soh_res;

  const I_sc_max = pack.v_max / R_eff;
  const P_sc_max = pack.v_max * pack.v_max / (4 * R_eff);

  const socs = [1.0, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1];
  const socLevels = socs.map(soc => {
    const voc = ocvPack(soc, pack.series);
    const i_sc = voc / R_eff;
    const p_sc = voc * i_sc / 1000;
    return { soc, v_oc_pack: voc, I_sc: i_sc, P_sc: p_sc };
  });

  return {
    v_max_pack: pack.v_max,
    v_nom_pack: pack.v_nom,
    R_pack_new: pack.resistance_Ohm,
    R_pack_eff: R_eff,
    I_sc_max,
    P_sc_max,
    socLevels,
  };
}
