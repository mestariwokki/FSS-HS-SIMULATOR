%RUN_FSO_PACK  HSC 13S2P bench tests with FSO_HSC_Pack.slx.
%   1) 198 A continuous discharge until the BMS trips (temperature or UV)
%   2) Your own current profile: set I_profile = [t_s, I_A] (I > 0 discharge)
here = fileparts(mfilename('fullpath'));
addpath(here);
if ~exist(fullfile(here, 'FSO_HSC_Pack.slx'), 'file'), build_fso_models; end

P = fso_params();
P.run.dt = 0.01;
I_profile = [0 P.bms.i_dis_cont; 7200 P.bms.i_dis_cont];   % 198 A constant

in  = Simulink.SimulationInput('FSO_HSC_Pack');
in  = in.setVariable('P', P);
in  = in.setVariable('I_profile', I_profile);
in  = in.setModelParameter('StopTime', num2str(I_profile(end, 1)));
out = sim(in);
L = out.logsout;
Vt = L.get('V_t').Values; T = L.get('T_bat').Values; trip = L.get('trip').Values;
soc = L.get('SOC').Values; E = L.get('E_Wh').Values;

codes = {'ok', 'discharge > peak', 'discharge > cont > 3 s', 'charge > peak', ...
         'charge > cont > 3 s', 'cell undervoltage', 'cell overvoltage', 'cell temperature'};
fprintf('\nHSC 13S2P at %.0f A (Simulink)\n', I_profile(1, 2));
fprintf('  stopped at          %.1f s, trip: %s\n', Vt.Time(end), codes{max(trip.Data) + 1});
if soc.Data(end) <= 0, fprintf('  pack empty (SOC = 0) before any BMS trip\n'); end
fprintf('  delivered           %.2f Ah, %.1f Wh, SOC %.1f %%\n', ...
        I_profile(1,2) * Vt.Time(end) / 3600, E.Data(end), soc.Data(end) * 100);
fprintf('  pack temperature    %.1f C\n', T.Data(end));

R = fso_reference_sim(P, 'pack', I_profile);
fprintf('  reference loop      stopped at %.1f s, T %.1f C\n', R.t(end), R.T_bat(end));

figure('Name', 'HSC 13S2P bench');
subplot(2,1,1); plot(Vt.Time, Vt.Data); ylabel('V_{HSC} [V]'); grid on;
subplot(2,1,2); plot(T.Time, T.Data); ylabel('T_{cell} [C]'); xlabel('t [s]'); grid on;
