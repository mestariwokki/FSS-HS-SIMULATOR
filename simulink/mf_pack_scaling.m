function [V_oc, V_eff, R0p, R1p, R2p] = mf_pack_scaling(ocv_cell, r0_cell, r1_cell, r2_cell, Vrc1, Vrc2, T_C, P)
%MF_PACK_SCALING  Cell values -> 13S2P pack values (MATLAB Function block "Pack_Scaling").
%   Uses only states (SOC, T, V_rc), never the current, so the hybrid
%   controller can read V_eff and R0p without an algebraic loop.
k = P.pack.S / P.pack.Par;
V_oc  = ocv_cell * P.pack.S;
V_eff = V_oc - Vrc1 - Vrc2;
R0p   = r0_cell * exp(P.ecm.k_T * (25 - T_C)) * k;   % Arrhenius-type correction
R1p   = r1_cell * k;
R2p   = r2_cell * k;
end
