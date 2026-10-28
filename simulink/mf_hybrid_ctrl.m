function [a, I_bat, P_em_kW, P_ice_kW, F_em, F_ice, N_f, N_r, RPM_ice, P_bat_W, boost_on, dfuel_gs] = ...
    mf_hybrid_ctrl(v_in, a_f, boost_t, V_eff, R0p, AIR, P)
%MF_HYBRID_CTRL  M06H hybrid power split and longitudinal dynamics
%   (MATLAB Function block "Hybrid_Controller"). Mirrors hybridStep.ts.
%
%   Front axle: 2 x hub BLDC (EM), traction limit mu*N_f.
%   Rear axle:  ICE -> gearbox, traction limit mu*N_r.
%   Strategy:   ICE first, EM covers the rest (full throttle in mode 1,
%               road-load hold at v_cruise in mode 2).
%   Battery:    EM electrical power -> pack current from
%               I^2 R0 - I V_eff + P = 0, limited by the matched-impedance
%               power and the 198 A continuous cell rating. AIR = 0 -> no EM.
g = P.veh.g; m = P.veh.m;
v = max(0.05, v_in);
omega_w = v / P.veh.r_w;
RPM_w   = omega_w * 60 / (2*pi);
RPM_ice = max(P.ice.rpm_idle, RPM_w * P.ice.gear);

% Weight transfer with filtered acceleration
dN  = m * a_f * P.veh.h_cg / P.veh.L;
N_f = max(0, m*g*P.veh.f_front - dN);
N_r = max(0, m*g*(1 - P.veh.f_front) + dN);

% Battery power capability
I_max = P.bms.i_dis_cont;
Ve    = max(0, V_eff);
P_matched = Ve^2 / (4 * R0p);
I_lim = min(I_max, Ve / (2 * R0p));
P_curr = max(0, (Ve - I_lim * R0p) * I_lim);
P_bat_max_W = min(P_matched, P_curr) * AIR;

% EM capability (front)
peak = boost_t < P.em.boost_s;
if peak
    P_em_lim_kW = P.em.P_peak_kW;  I_em = P.em.I_peak;
else
    P_em_lim_kW = P.em.P_cont_kW;  I_em = P.em.I_cont;
end
P_em_avail_kW = min(P_em_lim_kW, P_bat_max_W * P.em.eta / 1000);
T_cur = P.em.Kt * I_em * P.em.gear * 2 * P.em.eta;
T_pow = P_em_avail_kW * 1000 / omega_w;
F_em_max = min(min(T_cur, T_pow) / P.veh.r_w, P.veh.mu * N_f) * AIR;

% ICE capability (rear)
T_ice_sh = interp1(P.ice.rpm, P.ice.T, min(max(RPM_ice, P.ice.rpm(1)), P.ice.rpm(end)));
F_ice_max = min(T_ice_sh * P.ice.gear * P.ice.eta_dl / P.veh.r_w, P.veh.mu * N_r);

% Demand
F_drag = 0.5 * P.veh.rho * P.veh.CdA * v^2;
F_roll = P.veh.Crr * m * g;
if P.run.mode == 2 && v_in >= 0.98 * P.run.v_cruise
    F_dem = F_drag + F_roll;                 % hold speed
else
    F_dem = F_em_max + F_ice_max;            % full throttle
end

% ICE-first split
if F_dem <= F_ice_max
    F_ice = max(0, F_dem);  F_em = 0;
else
    F_ice = F_ice_max;      F_em = min(F_dem - F_ice, F_em_max);
end

P_em_kW  = F_em  * v / 1000;
P_ice_kW = F_ice * v / 1000;
a = (F_em + F_ice - F_drag - F_roll) / m;

% Pack current for the EM electrical power
P_bat_W = P_em_kW * 1000 / max(0.5, P.em.eta);
disc = Ve^2 - 4 * R0p * P_bat_W;
if disc < 0
    I_bat = Ve / (2 * R0p);
else
    I_bat = (Ve - sqrt(disc)) / (2 * R0p);
end
I_bat = max(0, I_bat) * AIR;

boost_on = double(P_em_kW >= P.em.P_cont_kW);
dfuel_gs = P_ice_kW * P.ice.bsfc / 3600;
end
