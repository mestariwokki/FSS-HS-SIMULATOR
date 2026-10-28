%RUN_FSO_HYBRID  75 m acceleration run of FSO_M06H_Hybrid.slx and the reference loop.
%   Builds the models first if the .slx files are missing.
here = fileparts(mfilename('fullpath'));
addpath(here);
if ~exist(fullfile(here, 'FSO_M06H_Hybrid.slx'), 'file'), build_fso_models; end

P = fso_params();
P.run.mode = 1;              % 1 = full throttle, 2 = cruise at P.run.v_cruise (set x_stop = Inf)
P.run.soc0 = 1.00;

in  = Simulink.SimulationInput('FSO_M06H_Hybrid');
in  = in.setVariable('P', P);
out = sim(in);
L = out.logsout;
sig = @(n) L.get(n).Values;
x = sig('x'); v = sig('v'); I = sig('I_bat'); Vt = sig('V_t');
Pem = sig('P_em_kW'); Pice = sig('P_ice_kW'); T = sig('T_bat'); trip = sig('trip');

fprintf('\nFSO M06H hybrid, 75 m (Simulink)\n');
fprintf('  time to 75 m        %.3f s\n', x.Time(end));
fprintf('  end speed           %.1f km/h\n', v.Data(end) * 3.6);
fprintf('  peak HSC current    %.1f A  (limit %.0f A cont / %.0f A 3 s)\n', ...
        max(I.Data), P.bms.i_dis_cont, P.bms.i_dis_peak);
fprintf('  min HSC voltage     %.2f V  (%.3f V/cell)\n', min(Vt.Data), min(Vt.Data) / P.pack.S);
fprintf('  pack temperature    %.2f C at the end\n', T.Data(end));
fprintf('  BMS trip code       %d\n', max(trip.Data));

R = fso_reference_sim(P, 'hybrid');
fprintf('  reference loop      %.3f s to 75 m, peak %.1f A\n', R.t(end), max(R.I));

figure('Name', 'FSO M06H hybrid 75 m');
subplot(3,1,1); plot(v.Time, v.Data*3.6); ylabel('v [km/h]'); grid on;
subplot(3,1,2); plot(Pem.Time, Pem.Data, Pice.Time, Pice.Data); ylabel('P [kW]'); legend('EM', 'ICE'); grid on;
subplot(3,1,3); yyaxis left; plot(I.Time, I.Data); ylabel('I_{HSC} [A]');
yyaxis right; plot(Vt.Time, Vt.Data); ylabel('V_{HSC} [V]'); xlabel('t [s]'); grid on;
