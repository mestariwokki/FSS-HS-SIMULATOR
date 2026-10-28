function [trip, AIR, v_cell] = mf_bms(V_pack, I, T_C, P)
%MF_BMS  HSC protection per FSG T11.7.7 and the EP9343126VVP datasheet
%   (MATLAB Function block "BMS", discrete, sample time P.bms.Ts).
%
%   trip codes (latched, first one wins):
%     0 ok
%     1 discharge current > peak (330 A)        immediate
%     2 discharge current > cont (198 A) > 3 s
%     3 charge current > peak (106 A)           immediate
%     4 charge current > cont (52.8 A) > 3 s
%     5 cell undervoltage  > 0.5 s
%     6 cell overvoltage   > 0.5 s
%     7 cell temperature out of range > 1 s (charge 0..45, discharge -20..60 C)
%   AIR = 1 while closed, 0 after a trip. Cell voltage = V_pack / S.
persistent uv ov ot dp cp latched
if isempty(uv)
    uv = 0; ov = 0; ot = 0; dp = 0; cp = 0; latched = 0;
end
dt = P.bms.Ts;
v_cell = V_pack / P.pack.S;
charging = I < 0;
I_chg = -I;

if v_cell < P.bms.v_cell_min, uv = uv + dt; else, uv = 0; end
if v_cell > P.bms.v_cell_max, ov = ov + dt; else, ov = 0; end
if charging
    t_lo = P.bms.t_chg_min; t_hi = P.bms.t_chg_max;
else
    t_lo = P.bms.t_dis_min; t_hi = P.bms.t_dis_max;
end
if T_C > t_hi || T_C < t_lo, ot = ot + dt; else, ot = 0; end
if I > P.bms.i_dis_cont, dp = dp + dt; else, dp = 0; end
if I_chg > P.bms.i_chg_cont, cp = cp + dt; else, cp = 0; end

tol = 1e-9;
code = 0;
if I > P.bms.i_dis_peak
    code = 1;
elseif dp > P.bms.peak_s + tol
    code = 2;
elseif I_chg > P.bms.i_chg_peak
    code = 3;
elseif cp > P.bms.peak_s + tol
    code = 4;
elseif uv > P.bms.v_delay_s + tol
    code = 5;
elseif ov > P.bms.v_delay_s + tol
    code = 6;
elseif ot > P.bms.t_delay_s + tol
    code = 7;
end
if latched == 0 && code > 0
    latched = code;
end
trip = latched;
AIR = double(latched == 0);
end
