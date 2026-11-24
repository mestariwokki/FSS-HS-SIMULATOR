# Simulink models: HSC pack and M06H hybrid

Two Simulink models built from the same equations and parameters as the web simulator.

| Model | What it is |
|---|---|
| `FSO_HSC_Pack.slx` | HSC 13S2P (EP9343126VVP) bench: a current profile `I_profile = [t I]` drives the pack. The run stops on a BMS trip or when the pack is empty. |
| `FSO_M06H_Hybrid.slx` | The M06H in the 75 m acceleration event (or cruise): ICE on the rear axle, 2 × hub BLDC on the front, HSC pack and BMS. A BMS trip opens the AIRs and the car carries on with the ICE alone. |

The `.slx` files are not committed. You generate them with a script, so that the block code stays readable in git.

## Usage (MATLAB R2019b or newer with Simulink, no other toolboxes)

```matlab
cd simulink
build_fso_models     % writes FSO_HSC_Pack.slx and FSO_M06H_Hybrid.slx
run_fso_hybrid       % 75 m run: time, peak HSC current, plots
run_fso_pack         % 198 A until the BMS trips
```

`P = fso_params()` holds every parameter. To change a value for one run, edit `P` and pass it with `Simulink.SimulationInput.setVariable('P', P)`, as the run scripts do. When you open a model, it loads `P` on its own if `P` is not in the workspace yet.

## Structure

```
FSO_M06H_Hybrid
├── Powertrain_Vehicle
│   ├── Hybrid_Controller   mf_hybrid_ctrl.m   weight transfer, EM/ICE limits, ICE-first split,
│   │                                          road load, pack current from EM power
│   ├── Motor_Thermal       mf_motor_thermal.m BLDC + ESC lumped thermal
│   └── integrators         v, x, a_f (weight-transfer filter), boost_t, fuel_g, T_bldc, T_esc
├── HSC_Pack_13S2P          (same subsystem in FSO_HSC_Pack)
│   ├── 1-D lookups         OCV(SOC), R0/R1/R2(SOC) per cell
│   ├── Pack_Scaling        mf_pack_scaling.m  cell → 13S2P, Arrhenius R0/R1/R2(T), OCV(T),
│   │                                          HSC-internal + cable resistance
│   ├── ECM_Thermal         mf_ecm_thermal.m   2RC Thevenin + 3-node HSC thermal
│   │                                          (hot cells / other cells / structure) + core lag
│   └── integrators         SOC, V_rc1, V_rc2, T_C = [T_hot; T_cells; T_struct; dT_core], E_Wh
├── BMS_T11_7_7             mf_bms.m           discrete 10 ms, FSG T11.7.7 + datasheet limits, latched
└── AIR (prev step)         Memory: breaks the loop BMS → controller
```

The cell model is the same as `src/simulation/cellModel.ts` and `hscThermal.ts` in the web simulator (EP9343126VVP 2RC with Arrhenius R(T) and SOC factors, entropic heat, OCV temperature shift). The thermal network is selected with `P.th.concept = 'A' | 'B' | 'C'`. The BMS reads the hot-node surface temperature (`T_C(1)`, EV5.8.5); the core runs `dT_core` hotter with a 60 s lag.

BMS trip codes: 1 discharge > 330 A, 2 > 198 A for over 3 s, 3 charge > 106 A, 4 > 52.8 A for over 3 s, 5 cell undervoltage for over 0.5 s, 6 overvoltage for over 0.5 s, 7 temperature out of range for over 1 s (charge 0…45 °C, discharge −20…60 °C).

## Checking against the web simulator

`fso_reference_sim.m` runs the same `mf_*.m` functions in a plain loop (RK4, the same as `ode4`), so it also works in Octave without Simulink. Both run scripts print the reference result next to the Simulink result, and the two should agree.

The reference loop was checked against `runHybridSim()` (web simulator) using the default parameters. See the PR description for the numbers.

Differences from the web simulator:
- Continuous states with ode4 at 1 ms instead of explicit Euler at 50 ms. The weight-transfer filter α = 0.12 per 50 ms becomes τ = 0.39 s.
- In the hybrid model the pack temperature is a state, and R(T) follows it. The web hybrid tab keeps the temperature fixed. Over a 4 s run the difference is negligible.
- Checked in Octave 8.4 against the TS model: 60 A constant from 95 % SOC, 30 °C, concept A. At 600 s the hot node is 43.98 °C (TS 43.92 °C), the core 46.08 °C (TS 46.00 °C) and the HSC voltage within 10 mV after the cable drop. The structure node is 0.5 K cooler than in TS. The 75 m hybrid run gives 3.90 s and 140 A peak (endurance tab 3.84 s).
- The hybrid model has a BMS and AIRs. The web hybrid tab has none.

## Still estimates

The OCV table, R0/R1/R2, τ1/τ2, the activation energies and the thermal conductances are not in the datasheet. Fit them from test data with `npm run fit` (see `../docs/calibration.md`) and copy the same numbers into `cellModel.ts`, `hscThermal.ts` and `fso_params.m`. Then run `npm test`, `node ../validate.mjs` and these scripts again. The `.slx` build was not run in this change (no MATLAB here); the reference loop was.
