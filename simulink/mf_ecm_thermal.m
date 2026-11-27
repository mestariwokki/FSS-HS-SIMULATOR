function [V_t, dVrc1, dVrc2, dT, P_loss, dE_Wh] = mf_ecm_thermal(I, V_eff, R0p, R1p, R2p, Vrc1, Vrc2, T_C, T_amb_C, P)
%MF_ECM_THERMAL  2RC Thevenin terminal voltage and 3-node HSC thermal model
%   (MATLAB Function block "ECM_Thermal"). I > 0 = discharge.
%   Same equations as src/simulation/cellModel.ts + hscThermal.ts.
%
%   V_t     = V_eff - I*R0p                 (R0p incl. busbars/AIR/fuse/cables)
%   dV_rci  = (I*R_i - V_rci) / tau_i
%   Q_cells = I^2 (R0p - R_ext) + V_rc1^2/R1 + V_rc2^2/R2 - I*S*T[K]*dU/dT(OCV)
%   Q_struct= I^2 R_hsc_int                 (busbars, AIR, fuse, shunt)
%   T_C = [T_hot (surface, BMS sensor); T_cells; T_struct; dT_core (hot cell core rise)]
V_t    = V_eff - I * R0p;
dVrc1  = (I * R1p - Vrc1) / P.ecm.tau1;
dVrc2  = (I * R2p - Vrc2) / P.ecm.tau2;
R_cell = max(R0p - P.ecm.R_hsc_int - P.ecm.R_cables, 0);
ocv    = (V_eff + Vrc1 + Vrc2) / P.pack.S;
dudt   = interp1(P.th.ocv_pts, P.th.dudt, min(max(ocv, P.th.ocv_pts(1)), P.th.ocv_pts(end)));
Tm     = P.th.f_hot * T_C(1) + (1 - P.th.f_hot) * T_C(2);
Q_rev  = -I * P.pack.S * (Tm + 273.15) * dudt;
P_loss = I^2 * R_cell + Vrc1^2 / R1p + Vrc2^2 / R2p + Q_rev;   % heat in the cells
Q_str  = I^2 * P.ecm.R_hsc_int;

C_hot = P.th.mCp_cells * P.th.f_hot;
C_c   = P.th.mCp_cells * (1 - P.th.f_hot);
q_hs = P.th.UA_hs * (T_C(1) - T_C(3));
q_cs = P.th.UA_cs * (T_C(2) - T_C(3));
q_hc = P.th.UA_hc * (T_C(1) - T_C(2));
q_a  = P.th.UA_amb * (T_C(3) - T_amb_C);
q_cell = max(P_loss, 0) / (P.pack.S * P.pack.Par);
dT = zeros(4, 1);
dT(1) = (P.th.f_hot * P_loss - q_hs - q_hc) / C_hot;
dT(2) = ((1 - P.th.f_hot) * P_loss - q_cs + q_hc) / C_c;
dT(3) = (Q_str + q_hs + q_cs - q_a) / P.th.C_struct;
dT(4) = (q_cell * P.th.R_int - T_C(4)) / P.th.tau_core;
dE_Wh  = V_t * I / 3600;
end
