function R = fso_reference_sim(P, model, I_profile)
%FSO_REFERENCE_SIM  The two Simulink models as a plain MATLAB/Octave loop.
%   R = fso_reference_sim(P, 'hybrid')            FSO_M06H_Hybrid
%   R = fso_reference_sim(P, 'pack', I_profile)   FSO_HSC_Pack, I_profile = [t I]
%
%   Calls the same mf_*.m functions as the MATLAB Function blocks and
%   integrates the same states with RK4 (= Simulink ode4) at P.run.dt; the
%   BMS runs every P.bms.Ts like the discrete block. Use it to check the
%   .slx results, or to run the model without Simulink.

if nargin < 2, model = 'hybrid'; end
is_hybrid = strcmp(model, 'hybrid');
clear mf_bms                       % reset the BMS timers (persistent)

dt = P.run.dt;
% state: 1 soc 2 Vrc1 3 Vrc2 4 T_C 5 E_Wh 6 v 7 x 8 a_f 9 boost_t 10 fuel_g 11 T_bldc 12 T_esc
s = [P.run.soc0; 0; 0; P.run.T0_C; 0; P.run.v0; 0; 0; 0; 0; P.mt.T_amb; P.mt.T_amb];
if is_hybrid
    t_end = P.run.t_stop;
else
    t_end = I_profile(end, 1);
end
n_max = floor(t_end / dt) + 1;
log = zeros(n_max, 14);
AIR = 1; AIR_next = 1; trip = 0; v_cell = 0;
n_bms = max(1, round(P.bms.Ts / dt));
t = 0; n = 0;

while n < n_max
    if is_hybrid
        I_ext = 0;
    else
        I_ext = interp1(I_profile(:,1), I_profile(:,2), min(t, I_profile(end,1)));
    end
    [ds, y] = deriv(s, AIR, I_ext, P, is_hybrid);

    if mod(n, n_bms) == 0             % discrete BMS, then Memory block
        AIR_next = AIR;
        [trip, AIR_next, v_cell] = mf_bms(y.V_t, y.I, s(4), P);
    end
    n = n + 1;
    log(n, :) = [t, y.V_t, y.I, s(1), s(4), s(6), s(7), y.a, y.P_em_kW, y.P_ice_kW, ...
                 trip, v_cell, s(10), s(5)];

    if is_hybrid && s(7) >= P.run.x_stop, break; end
    if ~is_hybrid && ((trip > 0 && P.run.stop_on_trip) || s(1) <= 0), break; end

    % RK4 with inputs held over the step
    k1 = ds;
    k2 = deriv(s + dt/2*k1, AIR, I_ext, P, is_hybrid);
    k3 = deriv(s + dt/2*k2, AIR, I_ext, P, is_hybrid);
    k4 = deriv(s + dt*k3, AIR, I_ext, P, is_hybrid);
    s = s + dt/6 * (k1 + 2*k2 + 2*k3 + k4);
    s(1) = min(max(s(1), 0), 1);      % integrator limits
    s(6) = max(s(6), 0);
    s(9) = min(max(s(9), 0), P.em.boost_s);
    t = t + dt;
    if mod(n - 1, n_bms) == 0, AIR = AIR_next; end
end

log = log(1:n, :);
names = {'t','V_t','I','soc','T_bat','v','x','a','P_em_kW','P_ice_kW','trip','v_cell','fuel_g','E_Wh'};
for k = 1:numel(names)
    R.(names{k}) = log(:, k);
end
end

function [ds, y] = deriv(s, AIR, I_ext, P, is_hybrid)
soc = s(1); Vrc1 = s(2); Vrc2 = s(3); T_C = s(4);
ocv = interp1(P.ocv.soc, P.ocv.V, clip(soc, P.ocv.soc));
r0  = interp1(P.ecm.soc, P.ecm.R0, clip(soc, P.ecm.soc));
r1  = interp1(P.ecm.soc, P.ecm.R1, clip(soc, P.ecm.soc));
r2  = interp1(P.ecm.soc, P.ecm.R2, clip(soc, P.ecm.soc));
[~, V_eff, R0p, R1p, R2p] = mf_pack_scaling(ocv, r0, r1, r2, Vrc1, Vrc2, T_C, P);

ds = zeros(12, 1);
y.a = 0; y.P_em_kW = 0; y.P_ice_kW = 0;
if is_hybrid
    [a, I, P_em_kW, P_ice_kW, ~, ~, ~, ~, ~, P_bat_W, boost_on, dfuel] = ...
        mf_hybrid_ctrl(s(6), s(8), s(9), V_eff, R0p, AIR, P);
    [dTb, dTe] = mf_motor_thermal(P_bat_W, s(11), s(12), P);
    ds(6) = a;  ds(7) = s(6);  ds(8) = (a - s(8)) / P.veh.tau_w;
    ds(9) = boost_on;  ds(10) = dfuel;  ds(11) = dTb;  ds(12) = dTe;
    y.a = a; y.P_em_kW = P_em_kW; y.P_ice_kW = P_ice_kW;
else
    I = I_ext;
end
[V_t, dV1, dV2, dT, ~, dE] = mf_ecm_thermal(I, V_eff, R0p, R1p, R2p, Vrc1, Vrc2, T_C, P.run.T_amb_C, P);
ds(1) = -I / (3600 * P.pack.Q_Ah);
ds(2) = dV1; ds(3) = dV2; ds(4) = dT; ds(5) = dE;
y.V_t = V_t; y.I = I;
end

function x = clip(x, bp)
x = min(max(x, bp(1)), bp(end));
end
