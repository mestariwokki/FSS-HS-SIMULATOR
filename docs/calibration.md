# Calibrating the HSC model with test data

Three tests replace the estimated parameters in `cellModel.ts` and
`hscThermal.ts` with measured ones. They fit the "cell discharge + HSC
resistance" item of the HSC Test Plan 2027. `scripts/fit.mjs` turns the logs
into the numbers to paste into the code.

## CSV format

One header row; comma, semicolon or tab separated; decimal comma is fine with
`;` or tab. Column names are matched case-insensitively:

| Quantity | Accepted names |
|---|---|
| time [s] | `t`, `t_s`, `time`, `time_s`, `aika` |
| current [A], **discharge positive** | `i`, `i_a`, `current`, `current_a`, `virta` |
| cell voltage [V] (at the tabs) | `v`, `u`, `voltage`, `jannite`, `jännite` |
| temperature [°C] | `t_c`, `temp`, `temperature`, `lampotila`, `lämpötila`, `t_cell` |

Any other column (e.g. `t_center`, `t_endplate`, `t_amb`) is kept and can be
selected with `--col` / `--amb`. If your logger records discharge as negative
current, add `--flip`.

Measure the voltage with separate sense wires on the cell tabs, not through
the current leads, or the lead resistance ends up in R0.

## 1. OCV curve — one cell, 25 °C

1. Charge CC-CV 1C to 4.45 V, cut-off 0.05C (datasheet standard charge). Rest 2 h.
2. Discharge at **C/10 (0.66 A)** to 2.75 V, log every 10 s. Rest 2 h.
3. Charge at C/10 to 4.45 V (CC only), log every 10 s.

```
npm run fit -- ocv discharge.csv charge.csv
```

Paste the printed `OCV_CELL_V` into `src/simulation/cellData.ts`. Takes
~21 h of tester time; the charge half can be skipped (less accurate).

## 2. HPPC pulses — one cell, 0 °C, 25 °C and 45 °C

At each temperature (cell soaked ≥ 2 h in a fridge / oven / climate box):

1. Fully charge (standard charge at 25 °C before cooling/heating).
2. Repeat 9 times: **rest 10 min → 10 s discharge at 33 A (5C) → rest 60 s →
   discharge 0.66 Ah at 3.3 A (10 % SOC)**.
3. Log at **10 Hz or faster** (R0 is read from the first sample after the step).

```
npm run fit -- hppc 0=hppc_0C.csv 25=hppc_25C.csv 45=hppc_45C.csv
```

Prints R0, R1/τ1, R2/τ2 per SOC and temperature, the activation energies and
the SOC factors, ready to paste into `EP9343126VVP_MODEL`. The 60 s rest
after each pulse is what lets the fit separate the slow and fast RC terms;
don't shorten it.

Optional: one 3 s pulse at 165 A (25C) at 50 % SOC, 25 °C, to confirm the
model at the datasheet peak.

## 3. Stack heating — the built HSC stack (or a 13S dummy stack)

1. Thermocouples / NTCs: one on the **centre cell surface** of a stack, one on
   an **end plate**, one in the air next to the HSC. Same positions as the
   BMS sensors if possible.
2. Assemble with the real compression, housing and lid, car-like airflow
   (none for the worst case).
3. Discharge the pack at a **constant 60 A for 20 min** (or the endurance
   RMS current from the simulator), then rest **30 min**, logging every 1 s.

```
npm run fit -- thermal stack.csv --col t_center --amb t_amb --parallel 2 --rcell 0.0030
```

`--rcell` is the 10 s cell DC resistance at the test temperature from the
HPPC fit. The result is the effective heat capacity and conductance of the
centre cell; multiplied by the number of cells in the hot node it gives
`UA_hot_struct_WK + UA_hot_cells_WK` in `hscThermal.ts`. Run it again with
`--col t_endplate` for the structure node.

## 4. After fitting

Run `npm test` and `node validate.mjs`. The datasheet checks must still pass;
if one fails, the cell or the test setup is off (check the sense wires and
the temperature soak first).
