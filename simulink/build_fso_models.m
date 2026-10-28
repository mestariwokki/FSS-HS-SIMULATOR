function build_fso_models()
%BUILD_FSO_MODELS  Create FSO_HSC_Pack.slx and FSO_M06H_Hybrid.slx in this folder.
%
%   Run in MATLAB (R2019b or newer, Simulink, no other toolboxes):
%       cd simulink
%       build_fso_models
%
%   FSO_HSC_Pack     HSC 13S2P test bench: current profile I_profile = [t I]
%                    -> pack (OCV + 2RC ECM + lumped thermal) -> BMS (T11.7.7).
%   FSO_M06H_Hybrid  Full-throttle / cruise run of the M06H hybrid: ICE rear,
%                    2 x hub BLDC front, HSC pack and BMS. A BMS trip opens the
%                    AIRs and the car continues on the ICE alone.
%
%   All block code lives in the mf_*.m files of this folder, so the same
%   equations can be run without Simulink (fso_reference_sim.m).

here = fileparts(mfilename('fullpath'));
build_pack_model(here);
build_hybrid_model(here);
fprintf('Built FSO_HSC_Pack.slx and FSO_M06H_Hybrid.slx in %s\n', here);
end

% ═════════════════════════════════════════════════════════════════════════
function build_pack_model(here)
mdl = 'FSO_HSC_Pack';
new_model(mdl);

blk(mdl, 'built-in/FromWorkspace', 'I_profile [A]', [30 100 110 130], ...
    'VariableName', 'I_profile', 'Interpolate', 'on', 'OutputAfterFinalValue', 'Holding final value');
blk(mdl, 'built-in/Constant', 'T_amb [C]', [30 170 110 200], 'Value', 'P.run.T_amb_C');

pack = add_pack_subsystem(mdl, [200 80 360 260]);

bms = add_bms(mdl, [460 80 600 200]);

blk(mdl, 'built-in/Constant', 'zero', [620 260 650 280], 'Value', '0');
blk(mdl, 'built-in/RelationalOperator', 'tripped', [690 230 730 270], 'Operator', '>');
blk(mdl, 'built-in/Constant', 'stop_on_trip', [690 290 750 310], 'Value', 'P.run.stop_on_trip');
blk(mdl, 'built-in/Logic', 'AND', [790 240 820 300], 'Operator', 'AND', 'Inputs', '2');
blk(mdl, 'built-in/Stop', 'Stop on BMS trip', [870 255 910 285]);
blk(mdl, 'built-in/Scope', 'Pack scope', [700 40 740 140], 'NumInputPorts', '4');

ln(mdl, 'I_profile [A]/1', [pack '/1']);
ln(mdl, 'T_amb [C]/1', [pack '/2']);
ln(mdl, [pack '/1'], [bms '/1']);            % V_t
ln(mdl, 'I_profile [A]/1', [bms '/2']);
ln(mdl, [pack '/3'], [bms '/3']);            % T
ln(mdl, [bms '/1'], 'tripped/1');
ln(mdl, 'zero/1', 'tripped/2');
ln(mdl, 'tripped/1', 'AND/1');
ln(mdl, 'stop_on_trip/1', 'AND/2');
ln(mdl, 'AND/1', 'Stop on BMS trip/1');
ln(mdl, [pack '/1'], 'Pack scope/1');
ln(mdl, 'I_profile [A]/1', 'Pack scope/2');
ln(mdl, [pack '/2'], 'Pack scope/3');
ln(mdl, [pack '/3'], 'Pack scope/4');

logsig(mdl, 'I_profile [A]', 1, 'I');
log_pack_outputs(mdl, pack);
logsig(mdl, bms, 1, 'trip');
logsig(mdl, bms, 3, 'v_cell');

finish_model(here, mdl, '7200');
end

% ═════════════════════════════════════════════════════════════════════════
function build_hybrid_model(here)
mdl = 'FSO_M06H_Hybrid';
new_model(mdl);

blk(mdl, 'built-in/Constant', 'T_amb [C]', [30 330 110 360], 'Value', 'P.run.T_amb_C');

% ── Powertrain and vehicle ───────────────────────────────────────────────
pt = [mdl '/Powertrain_Vehicle'];
add_block('built-in/Subsystem', pt, 'Position', [200 60 380 240]);
blk(pt, 'built-in/Inport', 'V_eff', [20 60 50 74]);
blk(pt, 'built-in/Inport', 'R0p', [20 110 50 124]);
blk(pt, 'built-in/Inport', 'AIR', [20 160 50 174], 'Port', '3');

ctrl = mfun(pt, 'Hybrid_Controller', [260 40 460 330], 'mf_hybrid_ctrl.m', {'P'}, '');
blk(pt, 'built-in/Integrator', 'v', [560 30 590 60], ...
    'InitialCondition', 'P.run.v0', 'LimitOutput', 'on', 'LowerSaturationLimit', '0', 'UpperSaturationLimit', 'inf');
blk(pt, 'built-in/Integrator', 'x', [640 30 670 60]);
blk(pt, 'built-in/Sum', 'a - a_f', [560 90 580 110], 'Inputs', '+-', 'IconShape', 'round');
blk(pt, 'built-in/Gain', 'Gain 1_tau_w', [600 85 640 115], 'Gain', '1/P.veh.tau_w');
blk(pt, 'built-in/Integrator', 'a_f', [670 85 700 115]);
blk(pt, 'built-in/Integrator', 'boost_t', [560 150 590 180], ...
    'LimitOutput', 'on', 'UpperSaturationLimit', 'P.em.boost_s', 'LowerSaturationLimit', '0');
blk(pt, 'built-in/Integrator', 'fuel_g', [560 210 590 240]);
mth = mfun(pt, 'Motor_Thermal', [640 260 760 340], 'mf_motor_thermal.m', {'P'}, '');
blk(pt, 'built-in/Integrator', 'T_bldc', [820 260 850 290], 'InitialCondition', 'P.mt.T_amb');
blk(pt, 'built-in/Integrator', 'T_esc', [820 310 850 340], 'InitialCondition', 'P.mt.T_amb');

% controller inputs: v, a_f, boost_t, V_eff, R0p, AIR
ln(pt, 'v/1', [ctrl '/1']);
ln(pt, 'a_f/1', [ctrl '/2']);
ln(pt, 'boost_t/1', [ctrl '/3']);
ln(pt, 'V_eff/1', [ctrl '/4']);
ln(pt, 'R0p/1', [ctrl '/5']);
ln(pt, 'AIR/1', [ctrl '/6']);
% controller outputs: a I_bat P_em_kW P_ice_kW F_em F_ice N_f N_r RPM_ice P_bat_W boost_on dfuel_gs
ln(pt, [ctrl '/1'], 'v/1');
ln(pt, 'v/1', 'x/1');
ln(pt, [ctrl '/1'], 'a - a_f/1');
ln(pt, 'a_f/1', 'a - a_f/2');
ln(pt, 'a - a_f/1', 'Gain 1_tau_w/1');
ln(pt, 'Gain 1_tau_w/1', 'a_f/1');
ln(pt, [ctrl '/11'], 'boost_t/1');
ln(pt, [ctrl '/12'], 'fuel_g/1');
ln(pt, [ctrl '/10'], [mth '/1']);
ln(pt, 'T_bldc/1', [mth '/2']);
ln(pt, 'T_esc/1', [mth '/3']);
ln(pt, [mth '/1'], 'T_bldc/1');
ln(pt, [mth '/2'], 'T_esc/1');

outs = {'I_bat [A]', ctrl, 2; 'x [m]', 'x', 1; 'v_ms', 'v', 1};
for k = 1:size(outs, 1)
    o = blk(pt, 'built-in/Outport', outs{k,1}, [920 40+60*k 950 54+60*k]);
    ln(pt, [strip_sys(outs{k,2}, pt) '/' num2str(outs{k,3})], [o '/1']);
end
for k = 3:9                          % unused controller outputs (logged only)
    t = blk(pt, 'built-in/Terminator', sprintf('term%d', k), [500 20+30*k 515 35+30*k]);
    ln(pt, [ctrl '/' num2str(k)], [t '/1']);
end
logsig(pt, 'Hybrid_Controller', 1, 'a');
logsig(pt, 'Hybrid_Controller', 2, 'I_bat');
logsig(pt, 'Hybrid_Controller', 3, 'P_em_kW');
logsig(pt, 'Hybrid_Controller', 4, 'P_ice_kW');
logsig(pt, 'Hybrid_Controller', 7, 'N_f');
logsig(pt, 'Hybrid_Controller', 8, 'N_r');
logsig(pt, 'Hybrid_Controller', 9, 'RPM_ice');
logsig(pt, 'v', 1, 'v');
logsig(pt, 'x', 1, 'x');
logsig(pt, 'fuel_g', 1, 'fuel_g');
logsig(pt, 'T_bldc', 1, 'T_bldc');
logsig(pt, 'T_esc', 1, 'T_esc');

% ── HSC pack and BMS ─────────────────────────────────────────────────────
pack = add_pack_subsystem(mdl, [480 60 640 240]);
bms  = add_bms(mdl, [740 60 880 180]);
blk(mdl, 'built-in/Memory', 'AIR (prev step)', [740 260 780 290], 'InitialCondition', '1');

ln(mdl, 'Powertrain_Vehicle/1', [pack '/1']);
ln(mdl, 'T_amb [C]/1', [pack '/2']);
ln(mdl, [pack '/4'], 'Powertrain_Vehicle/1');   % V_eff
ln(mdl, [pack '/5'], 'Powertrain_Vehicle/2');   % R0p
ln(mdl, [pack '/1'], [bms '/1']);
ln(mdl, 'Powertrain_Vehicle/1', [bms '/2']);
ln(mdl, [pack '/3'], [bms '/3']);
ln(mdl, [bms '/2'], 'AIR (prev step)/1');
ln(mdl, 'AIR (prev step)/1', 'Powertrain_Vehicle/3');

% ── Stop at the end of the 75 m run ──────────────────────────────────────
blk(mdl, 'built-in/Constant', 'x_stop', [480 330 540 350], 'Value', 'P.run.x_stop');
blk(mdl, 'built-in/RelationalOperator', 'x >= x_stop', [580 300 620 340], 'Operator', '>=');
blk(mdl, 'built-in/Stop', 'Stop at x_stop', [660 305 700 335]);
ln(mdl, 'Powertrain_Vehicle/2', 'x >= x_stop/1');
ln(mdl, 'x_stop/1', 'x >= x_stop/2');
ln(mdl, 'x >= x_stop/1', 'Stop at x_stop/1');

blk(mdl, 'built-in/Scope', 'Vehicle scope', [960 40 1000 160], 'NumInputPorts', '4');
ln(mdl, 'Powertrain_Vehicle/3', 'Vehicle scope/1');
ln(mdl, 'Powertrain_Vehicle/1', 'Vehicle scope/2');
ln(mdl, [pack '/1'], 'Vehicle scope/3');
ln(mdl, [pack '/3'], 'Vehicle scope/4');

log_pack_outputs(mdl, pack);
logsig(mdl, bms, 1, 'trip');
logsig(mdl, bms, 3, 'v_cell');

finish_model(here, mdl, 'P.run.t_stop');
end

% ═════════════════════════════════════════════════════════════════════════
function path = add_pack_subsystem(sys, pos)
%ADD_PACK_SUBSYSTEM  HSC 13S2P: OCV + 2RC ECM + lumped thermal.
%   In:  1 I_pack [A] (> 0 discharge), 2 T_amb [C]
%   Out: 1 V_t, 2 SOC, 3 T_C, 4 V_eff, 5 R0p, 6 P_loss, 7 E_Wh
path = [sys '/HSC_Pack_13S2P'];
add_block('built-in/Subsystem', path, 'Position', pos);
p = path;
blk(p, 'built-in/Inport', 'I_pack', [20 100 50 114]);
blk(p, 'built-in/Inport', 'T_amb', [20 420 50 434], 'Port', '2');

blk(p, 'built-in/Gain', 'Coulomb count', [100 40 160 70], 'Gain', '-1/(3600*P.pack.Q_Ah)');
blk(p, 'built-in/Integrator', 'SOC', [200 40 230 70], 'InitialCondition', 'P.run.soc0', ...
    'LimitOutput', 'on', 'UpperSaturationLimit', '1', 'LowerSaturationLimit', '0');
lut(p, 'OCV(SOC) cell', [290 20 350 60], 'P.ocv.soc', 'P.ocv.V');
lut(p, 'R0(SOC) cell', [290 80 350 120], 'P.ecm.soc', 'P.ecm.R0');
lut(p, 'R1(SOC) cell', [290 140 350 180], 'P.ecm.soc', 'P.ecm.R1');
lut(p, 'R2(SOC) cell', [290 200 350 240], 'P.ecm.soc', 'P.ecm.R2');
sc = mfun(p, 'Pack_Scaling', [420 20 580 300], 'mf_pack_scaling.m', {'P'}, '');
ecm = mfun(p, 'ECM_Thermal', [660 80 840 420], 'mf_ecm_thermal.m', {'P'}, '');
blk(p, 'built-in/Integrator', 'V_rc1', [900 100 930 130]);
blk(p, 'built-in/Integrator', 'V_rc2', [900 160 930 190]);
blk(p, 'built-in/Integrator', 'T_C', [900 220 930 250], 'InitialCondition', 'P.run.T0_C');
blk(p, 'built-in/Integrator', 'E_Wh', [900 340 930 370]);

ln(p, 'I_pack/1', 'Coulomb count/1');
ln(p, 'Coulomb count/1', 'SOC/1');
for nm = {'OCV(SOC) cell', 'R0(SOC) cell', 'R1(SOC) cell', 'R2(SOC) cell'}
    ln(p, 'SOC/1', [nm{1} '/1']);
end
% Pack_Scaling(ocv_cell, r0_cell, r1_cell, r2_cell, Vrc1, Vrc2, T_C)
ln(p, 'OCV(SOC) cell/1', [sc '/1']);
ln(p, 'R0(SOC) cell/1', [sc '/2']);
ln(p, 'R1(SOC) cell/1', [sc '/3']);
ln(p, 'R2(SOC) cell/1', [sc '/4']);
ln(p, 'V_rc1/1', [sc '/5']);
ln(p, 'V_rc2/1', [sc '/6']);
ln(p, 'T_C/1', [sc '/7']);
% ECM_Thermal(I, V_eff, R0p, R1p, R2p, Vrc1, Vrc2, T_C, T_amb)
ln(p, 'I_pack/1', [ecm '/1']);
ln(p, [sc '/2'], [ecm '/2']);
ln(p, [sc '/3'], [ecm '/3']);
ln(p, [sc '/4'], [ecm '/4']);
ln(p, [sc '/5'], [ecm '/5']);
ln(p, 'V_rc1/1', [ecm '/6']);
ln(p, 'V_rc2/1', [ecm '/7']);
ln(p, 'T_C/1', [ecm '/8']);
ln(p, 'T_amb/1', [ecm '/9']);
% outputs [V_t, dVrc1, dVrc2, dT, P_loss, dE_Wh]
ln(p, [ecm '/2'], 'V_rc1/1');
ln(p, [ecm '/3'], 'V_rc2/1');
ln(p, [ecm '/4'], 'T_C/1');
ln(p, [ecm '/6'], 'E_Wh/1');
t = blk(p, 'built-in/Terminator', 'V_oc unused', [620 20 635 35]);
ln(p, [sc '/1'], [t '/1']);

outs = {'V_t [V]', [ecm '/1']; 'SOC [-]', 'SOC/1'; 'T_cell [C]', 'T_C/1'; 'V_eff [V]', [sc '/2']; ...
        'R0 pack [Ohm]', [sc '/3']; 'P_loss [W]', [ecm '/5']; 'E [Wh]', 'E_Wh/1'};
for k = 1:size(outs, 1)
    o = blk(p, 'built-in/Outport', outs{k,1}, [1010 40+50*k 1040 54+50*k]);
    ln(p, outs{k,2}, [o '/1']);
end
end

function path = add_bms(sys, pos)
%ADD_BMS  In: V_pack, I_pack, T_C.  Out: trip code, AIR, v_cell.
path = mfun(sys, 'BMS_T11_7_7', pos, 'mf_bms.m', {'P'}, 'P.bms.Ts');
end

function log_pack_outputs(sys, pack)
names = {'V_t', 'SOC', 'T_bat', 'V_eff', 'R0p', 'P_loss', 'E_Wh'};
for k = 1:numel(names)
    logsig(sys, strip_sys(pack, sys), k, names{k});
end
end

% ═════════════════════════════════════════════════════════════════════════
% Helpers
function new_model(mdl)
if bdIsLoaded(mdl), close_system(mdl, 0); end
new_system(mdl);
load_system(mdl);
set_param(mdl, 'Solver', 'ode4', 'FixedStep', 'P.run.dt', ...
    'SignalLogging', 'on', 'SignalLoggingName', 'logsout', 'ReturnWorkspaceOutputs', 'on', ...
    'AlgebraicLoopMsg', 'error');
cb = 'if ~exist(''P'',''var''), P = fso_params(); end';
set_param(mdl, 'PreLoadFcn', cb, 'InitFcn', cb);
evalin('base', cb);
end

function finish_model(here, mdl, stop_time)
set_param(mdl, 'StopTime', stop_time);
try
    Simulink.BlockDiagram.arrangeSystem(mdl);
catch
end
save_system(mdl, fullfile(here, [mdl '.slx']));
close_system(mdl, 0);
end

function path = blk(sys, lib, name, pos, varargin)
path = [sys '/' name];
add_block(lib, path, 'Position', pos, varargin{:});
end

function lut(sys, name, pos, bp, tbl)
blk(sys, 'built-in/Lookup_n-D', name, pos, 'NumberOfTableDimensions', '1', ...
    'BreakpointsForDimension1', bp, 'Table', tbl, 'ExtrapMethod', 'Clip');
end

function ln(sys, from, to)
add_line(sys, strip_sys(from, sys), strip_sys(to, sys), 'autorouting', 'on');
end

function s = strip_sys(p, sys)
%STRIP_SYS  'model/sub/Block/1' -> 'Block/1' relative to sys.
pre = [sys '/'];
if strncmp(p, pre, numel(pre))
    s = p(numel(pre)+1:end);
else
    s = p;
end
end

function path = mfun(sys, name, pos, file, params, Ts)
%MFUN  MATLAB Function block whose code is read from file; listed
%   arguments become non-tunable parameters taken from the workspace.
path = [sys '/' name];
add_block('simulink/User-Defined Functions/MATLAB Function', path, 'Position', pos);
here = fileparts(mfilename('fullpath'));
code = fileread(fullfile(here, file));
ch = find(sfroot, '-isa', 'Stateflow.EMChart', 'Path', path);
ch.Script = code;
for k = 1:numel(params)
    d = find(ch, '-isa', 'Stateflow.Data', 'Name', params{k});
    d.Scope = 'Parameter';
    d.Tunable = false;
end
if ~isempty(Ts)
    try
        ch.SampleTime = Ts;
    catch
        set_param(path, 'SystemSampleTime', Ts);
    end
end
end

function logsig(sys, block, port, name)
ph = get_param([sys '/' strip_sys(block, sys)], 'PortHandles');
set_param(ph.Outport(port), 'DataLogging', 'on', ...
    'DataLoggingNameMode', 'Custom', 'DataLoggingName', name);
end
