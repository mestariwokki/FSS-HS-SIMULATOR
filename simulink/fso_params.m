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

%% 2RC ECM tables per cell at 25 °C (estimate; 13S2P R0 ≈ 24 mΩ at 50 % SOC)
P.ecm.soc  = [0.20 0.30 0.40 0.50 0.60 0.70 0.80 0.90 1.00];
P.ecm.R0   = [0.0048 0.0043 0.0039 0.0037 0.0036 0.0035 0.0035 0.0035 0.0036];
P.ecm.R1   = [0.0016 0.0014 0.0012 0.0011 0.0010 0.0010 0.0010 0.0010 0.0010];
P.ecm.R2   = [0.0010 0.0009 0.0008 0.0007 0.0007 0.0006 0.0006 0.0006 0.0006];
P.ecm.tau1 = 30;       % s
P.ecm.tau2 = 5;        % s
P.ecm.k_T  = 0.04;     % 1/K, R0(T) = R0_25 · exp(k_T·(25 − T))

%% Lumped pack thermal (estimate until the compressed stack is measured)
P.th.mCp     = 2700;   % J/K  (26 cells × 0.102 kg × ~1000 J/kgK)
P.th.hA      = 10;     % W/K
P.th.dUdT    = -5e-5 - 3e-5;   % V/K, dU/dT_pos − dU/dT_neg (entropic heat)

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
P.em.I_peak    = 100;      % A per motor
P.em.I_cont    = 86;       % A per motor
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
P.run.T0_C     = 25;       % initial pack temperature
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
