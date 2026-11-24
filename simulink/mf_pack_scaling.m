function [V_oc, V_eff, R0p, R1p, R2p] = mf_pack_scaling(ocv_cell, r0_cell, r1_cell, r2_cell, Vrc1, Vrc2, T_C, P)
%MF_PACK_SCALING  Cell values -> 13S2P pack values (MATLAB Function block "Pack_Scaling").
%   Uses only states (SOC, T, V_rc), never the current, so the hybrid
%   controller can read V_eff and R0p without an algebraic loop.
%   T_C is the thermal state [T_hot; T_cells; T_struct; dT_core]; the
%   resistances use the mean cell temperature (Arrhenius, as cellModel.ts).
%   R0p includes the HSC-internal and cable resistance.
k = P.pack.S / P.pack.Par;
Tm = P.th.f_hot * T_C(1) + (1 - P.th.f_hot) * T_C(2);
Tk = max(Tm, -50) + 273.15;
arr = @(Ea) exp(Ea / 8.31446 * (1 / Tk - 1 / 298.15));
dudt = interp1(P.th.ocv_pts, P.th.dudt, min(max(ocv_cell, P.th.ocv_pts(1)), P.th.ocv_pts(end)));
V_oc  = (ocv_cell + dudt * (Tm - 25)) * P.pack.S;
V_eff = V_oc - Vrc1 - Vrc2;
R0p   = r0_cell * arr(P.ecm.Ea_R0) * k + P.ecm.R_hsc_int + P.ecm.R_cables;
R1p   = r1_cell * arr(P.ecm.Ea_R1) * k;
R2p   = r2_cell * arr(P.ecm.Ea_R2) * k;
end
