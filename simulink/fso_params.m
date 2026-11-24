function P = fso_params()
%FSO_PARAMS  Parameters for the FSO M06H HSC (13S2P EP9343126VVP) and hybrid models.
%   P = fso_params() returns one struct used by every block in
%   FSO_HSC_Pack.slx and FSO_M06H_Hybrid.slx. The values mirror the web
%   simulator (src/simulation/cellData.ts, battery.ts, bms.ts,
%   motor/hybridStep.ts, components/hybrid/HybridTab.tsx).
%
%   Values marked "estimate" are not in the datasheet and must be replaced
%   with measurements (C/10 OCV test, pulse test, stack thermal test).

%% Cell: EP9343126VVP (Hongkong Mingda spec EP210828033 V1.01) — datasheet
P.cell.Q_Ah        = 6.6;
P.cell.V_max       = 4.45;
P.cell.V_nom       = 3.90;
P.cell.V_min       = 2.75;
P.cell.R_ac_typ    = 0.0021;    % Ω, 1 kHz
P.cell.I_dis_cont  = 99;        % A, 15C
P.cell.I_dis_peak  = 165;       % A, 25C, 3 s
P.cell.I_chg_cont  = 26.4;      % A, 4C
P.cell.I_chg_peak  = 53;        % A, 8C, 3 s
P.cell.peak_s      = 3;         % s
P.cell.T_dis_min_C = -20;
P.cell.T_dis_max_C = 60;        % also FSG T11.7.7 ceiling
P.cell.T_chg_min_C = 0;
P.cell.T_chg_max_C = 45;

%% Pack: 13S2P
P.pack.S    = 13;
P.pack.Par  = 2;
P.pack.Q_Ah = P.cell.Q_Ah * P.pack.Par;           % 13.2 Ah

%% OCV table per cell (estimate, anchored to datasheet)
P.ocv.soc = [0.00 0.05 0.10 0.20 0.30 0.40 0.50 0.60 0.70 0.80 0.90 1.00];
P.ocv.V   = [3.30 3.58 3.68 3.76 3.81 3.86 3.92 3.99 4.07 4.17 4.29 4.43];

%% 2RC ECM per cell — same model as src/simulation/cellModel.ts (estimate,
%  replace with `npm run fit -- hppc ...` results, docs/calibration.md)
%  Tables at 25 °C; Pack_Scaling applies Arrhenius factors for temperature.
%  RC1 = slow diffusion term, RC2 = fast charge-transfer term.
P.ecm.soc  = [0.00 0.05 0.10 0.20 0.30 0.50 0.80 0.95 1.00];
P.ecm.R0   = [0.003350 0.002887 0.002587 0.002426 0.002356 0.002310 0.002310 0.002356 0.002402];
P.ecm.R1   = [0.002250 0.001650 0.001200 0.000937 0.000825 0.000750 0.000750 0.000825 0.000900];
P.ecm.R2   = [0.000798 0.000688 0.000616 0.000578 0.000561 0.000550 0.000550 0.000561 0.000572];
P.ecm.tau1 = 40;       % s, diffusion
P.ecm.tau2 = 2;        % s, charge transfer
P.ecm.Ea_R0 = 18000;   % J/mol (R0 ×1.9 at 0 °C)
P.ecm.Ea_R1 = 30000;   % J/mol, diffusion
P.ecm.Ea_R2 = 45000;   % J/mol, charge transfer
% Resistance outside the cells: busbars + AIR + fuse + shunt (heats the HSC)
% and cables to the ESCs (voltage only). Pack values, not per cell.
P.ecm.R_hsc_int = 0.0012;  % Ω
P.ecm.R_cables  = 0.0014;  % Ω

%% Entropic coefficient dU/dT [V/K] vs cell OCV (LiCoO2/graphite, literature)
%  Indexed by OCV so the blocks need no SOC input; OCV is monotonic in SOC.
P.th.ocv_pts = [3.30 3.68 3.76 3.81 3.86 3.92 3.99 4.07 4.17 4.29 4.43];
P.th.dudt    = [-0.40 -0.35 -0.25 -0.15 -0.06 0.0 0.05 0.08 0.05 -0.02 -0.10] * 1e-3;

%% HSC thermal: 3 nodes [hot cells; other cells; structure] + hottest-cell core
%  rise, per design concept (src/simulation/hscThermal.ts). State T_C is the
%  vector [T_hot_surface; T_cells; T_struct; dT_core]. The BMS reads T_C(1)
%  (sensor on the cell surface / tab, EV5.8.5). Estimates from geometry.
P.th.concept = 'A';
P.th.mCp_cells = 26 * 0.102 * 1050;   % J/K, all cells
P.th.R_int   = 0.54;   % K/W, cell centre → surface
P.th.tau_core = 60;    % s
P.th.v_ref   = 15;     % m/s, airflow speed used for UA_amb in the pack bench
switch P.th.concept
    case 'A'   % two compressed stacks, passive
        P.th.f_hot = 10/26; P.th.C_struct = 1300; P.th.UA_hs = 0.15; P.th.UA_cs = 0.9;
        P.th.UA_hc = 0.6;  P.th.UA_amb0 = 1.0;  P.th.UA_kv = 0.12; P.th.UA_fan = 0;
    case 'B'   % flat slab, base-plate cooling
        P.th.f_hot = 13/26; P.th.C_struct = 1100; P.th.UA_hs = 0.3; P.th.UA_cs = 25;
        P.th.UA_hc = 4.0;  P.th.UA_amb0 = 0.8;  P.th.UA_kv = 0.35; P.th.UA_fan = 0;
    case 'C'   % single stack, Al fins + fan
        P.th.f_hot = 6/26;  P.th.C_struct = 900;  P.th.UA_hs = 6;   P.th.UA_cs = 30;
        P.th.UA_hc = 1.0;  P.th.UA_amb0 = 1.0;  P.th.UA_kv = 0.1;  P.th.UA_fan = 5.5;
end
P.th.UA_amb = P.th.UA_amb0 + P.th.UA_kv * P.th.v_ref^0.8 + P.th.UA_fan;

%% BMS — FSG T11.7.7 + datasheet
P.bms.v_cell_min = P.cell.V_min;
P.bms.v_cell_max = P.cell.V_max;
P.bms.i_dis_cont = P.cell.I_dis_cont * P.pack.Par;   % 198 A
P.bms.i_dis_peak = P.cell.I_dis_peak * P.pack.Par;   % 330 A
P.bms.i_chg_cont = P.cell.I_chg_cont * P.pack.Par;   % 52.8 A
P.bms.i_chg_peak = P.cell.I_chg_peak * P.pack.Par;   % 106 A
P.bms.peak_s     = P.cell.peak_s;
P.bms.v_delay_s  = 0.5;    % T11.7.7: voltage out of range > 500 ms
P.bms.t_delay_s  = 1.0;    % T11.7.7: temperature out of range > 1 s
P.bms.t_dis_min  = P.cell.T_dis_min_C;
P.bms.t_dis_max  = P.cell.T_dis_max_C;
P.bms.t_chg_min  = P.cell.T_chg_min_C;
P.bms.t_chg_max  = P.cell.T_chg_max_C;
P.bms.Ts         = 0.01;   % s, BMS sample time

%% Electric motors: 2 × Neumotors 6530/8.5/104, front hub, 3:1 planetary
P.em.P_peak_kW = 10.0;     % combined, limited by 198 A HSC rating
P.em.P_cont_kW = 7.0;
P.em.kV        = 104;      % RPM/V
P.em.Kt        = 60 / (2*pi*P.em.kV);   % Nm/A
P.em.I_peak    = 7.5 / P.em.Kt;   % A per motor: 7.5 Nm motor maximum (HSF Table 6.2, ≈ 82 A)
P.em.I_cont    = 7.5 / P.em.Kt;   % motor peak = nominal 85 A in the HSF; ESC 86 A cont is above it
P.em.eta       = 0.88;     % ESC + winding
P.em.gear      = 3.0;
P.em.boost_s   = 5.0;      % peak power allowed for 5 s

%% ICE: Yamaha, rear axle (dyno 2025-07-28)
P.ice.rpm = [500 1000 1500 2000 2500 3000 3500 4000 4500 5000 5500 5671 6000 6500 ...
             7000 7500 8000 8500 9000 9500 9703 10000 10500 11000];
P.ice.T   = [50.0 53.0 57.0 61.0 65.0 68.0 71.0 74.0 76.0 78.0 79.5 80.0 79.0 77.0 ...
             74.0 72.0 69.0 66.0 63.5 61.5 60.9 59.0 56.0 52.0];
P.ice.gear     = 9.5;      % 1st gear total ratio
P.ice.eta_dl   = 0.97;     % driveline efficiency
P.ice.rpm_idle = 500;
P.ice.bsfc     = 300;      % g/kWh

%% Vehicle (M06H drive diagram 2026)
P.veh.m     = 285;         % kg incl. driver
P.veh.r_w   = 0.412 / 2;   % m
P.veh.CdA   = 0.98;        % m²
P.veh.Crr   = 0.018;
P.veh.mu    = 1.60;
P.veh.h_cg  = 0.32;        % m
P.veh.L     = 1.55;        % m
P.veh.f_front = 0.39;
P.veh.rho   = 1.225;
P.veh.g     = 9.81;
P.veh.tau_w = 0.39;        % s, weight-transfer filter (web sim: α = 0.12 per 50 ms)

%% Motor / ESC / ICE thermal (from hybridStep.ts)
P.mt.Rth_bldc = 0.08;  P.mt.mCp_bldc = 600;
P.mt.Rth_esc  = 0.15;  P.mt.mCp_esc  = 200;  P.mt.esc_loss = 0.02;
P.mt.T_amb    = 25;

%% Run settings
P.run.soc0     = 1.00;     % initial SOC
P.run.T0_C     = 25;       % initial pack temperature (all thermal nodes)
P.run.T_amb_C  = 25;
P.run.x_stop   = 75;       % m, FS acceleration event
P.run.t_stop   = 60;       % s
P.run.v0       = 0.1;      % m/s
P.run.dt       = 1e-3;     % s, fixed step
P.run.mode     = 1;        % 1 = full throttle, 2 = cruise at v_cruise
P.run.v_cruise = 80 / 3.6; % m/s
P.run.Kp_cruise = 2000;    % W per m/s, cruise speed controller
P.run.stop_on_trip = 1;    % 1 = stop the pack test on a BMS trip
end
