function [V_t, dVrc1, dVrc2, dT, P_loss, dE_Wh] = mf_ecm_thermal(I, V_eff, R0p, R1p, R2p, Vrc1, Vrc2, T_C, T_amb_C, P)
%MF_ECM_THERMAL  2RC Thevenin terminal voltage and lumped pack thermal model
%   (MATLAB Function block "ECM_Thermal"). I > 0 = discharge.
%
%   V_t      = V_oc - I*R0 - V_rc1 - V_rc2
%   dV_rci   = (I*R_i - V_rci) / tau_i
%   mCp dT   = I^2 R0 + V_rc1^2/R1 + V_rc2^2/R2 + Q_rev - hA (T - T_amb)
%   Q_rev    = -I * S * T[K] * (dU/dT_pos - dU/dT_neg)
V_t    = V_eff - I * R0p;
dVrc1  = (I * R1p - Vrc1) / P.ecm.tau1;
dVrc2  = (I * R2p - Vrc2) / P.ecm.tau2;
P_loss = I^2 * R0p + Vrc1^2 / R1p + Vrc2^2 / R2p;
Q_rev  = -I * P.pack.S * (T_C + 273.15) * P.th.dUdT;
dT     = (P_loss + Q_rev - P.th.hA * (T_C - T_amb_C)) / P.th.mCp;
dE_Wh  = V_t * I / 3600;
end
