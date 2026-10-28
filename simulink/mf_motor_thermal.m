function [dT_bldc, dT_esc] = mf_motor_thermal(P_bat_W, T_bldc, T_esc, P)
%MF_MOTOR_THERMAL  BLDC and ESC lumped thermal models, per motor (symmetric load)
%   (MATLAB Function block "Motor_Thermal"). Mirrors hybridStep.ts.
P_per = P_bat_W / 2;
P_loss_bldc = max(0, P_per * (1 - P.em.eta));
P_loss_esc  = max(0, P_per * P.mt.esc_loss);
dT_bldc = (P_loss_bldc - (T_bldc - P.mt.T_amb) / P.mt.Rth_bldc) / P.mt.mCp_bldc;
dT_esc  = (P_loss_esc  - (T_esc  - P.mt.T_amb) / P.mt.Rth_esc)  / P.mt.mCp_esc;
end
