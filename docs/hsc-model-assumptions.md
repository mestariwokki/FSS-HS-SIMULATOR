# HSC model — assumptions, validation and first results

Model of the FSO M06H hybrid storage container (13S2P EP9343126VVP LiCoO2 pouch)
used by the **Battery**, **Hybrid System** and **Endurance (HSC)** tabs.
All three tabs now share one cell model: `src/simulation/cellModel.ts`.

Every number is tagged as **datasheet** (EP210828033 V1.01), **rule**
(FSG 2026 v1.1 text + 2027 changelog), **literature** or **estimate**.
Estimates must be replaced by measurements before the design is frozen —
see *Tests that would calibrate the model* at the end.

## 1. Cell model (`cellModel.ts`)

2RC equivalent circuit, all parameters functions of SOC and temperature:

```
V = OCV(SOC) + dU/dT(SOC)·(T − 25) − I·R0(SOC,T) − V1 − V2
Q = I²R0 + V1²/R1 + V2²/R2 − I·T·dU/dT          (Bernardi heat, I > 0 discharge)
R(T) = R(25 °C) · exp(Ea/R · (1/T − 1/298 K))
```

| Parameter | Value | Source |
|---|---|---|
| Capacity | 6.6 Ah, 0.2C to 2.75 V | datasheet |
| Voltage window | 2.75 – 4.45 V | datasheet |
| Mass, cp | 102 g, 1050 J/kgK | datasheet, literature |
| OCV curve | table 3.30 … 4.43 V, steep knee below 0 % | estimate shaped for HV-LCO, anchored to datasheet |
| R0 (ohmic) 25 °C, 50 % SOC | 2.31 mΩ (1.1 × 2.1 mΩ AC) | datasheet + estimate |
| R1, τ1 (charge transfer) | 0.55 mΩ, 2 s | estimate |
| R2, τ2 (diffusion) | 0.75 mΩ, 40 s | estimate |
| → 10 s DC resistance | 3.0 mΩ (25 °C), 7.9 mΩ (0 °C), 1.7 mΩ (45 °C) | result |
| Ea R0 / R1 / R2 | 18 / 45 / 30 kJ/mol | literature |
| R vs SOC | R0 ×1.45, R2 ×3 at 0 % SOC | literature shape |
| dU/dT vs SOC | −0.40 … +0.08 mV/K | literature (LCO/graphite) |
| Capacity vs T | 70 % at −20 °C, 100 % at 25 °C, 98 % at 60 °C | datasheet anchors |
| Weakest parallel group | −3 % capacity, +10 % resistance | estimate |

Pack resistance outside the cells: busbars + AIR + fuse + shunt 1.2 mΩ (heats
the HSC), cables to ESCs 1.4 mΩ (estimate). The BMS sees cell voltages, the
ESCs see the voltage after the cables.

### Validation against the datasheet (`__tests__/datasheet.test.ts`)

| Datasheet requirement | Model | OK |
|---|---|---|
| 0.2C capacity ≥ 98 % | 101.5 % | ✅ |
| 1C average voltage 3.90 V | 3.903 V | ✅ |
| 99 A (15C) capacity ≥ 85 % | 100.6 % (cell reaches 68 °C in still air) | ✅ * |
| −20 °C, 1C ≥ 60 % | 76 % | ✅ |
| 60 °C, 1C ≥ 95 % | 99.9 % | ✅ |
| 165 A for 3 s above 2.75 V | yes | ✅ |
| Max voltage 13 × 4.45 = 57.85 V < 60 V | yes | ✅ |

\* The model has no rate-dependent capacity loss, so at 15C it is optimistic
(real cells of this type usually give 90–95 %). It does not matter for
endurance, where the pack runs at 5C RMS.

## 2. HSC thermal model (`hscThermal.ts`)

Three nodes per concept: **hot cells** (worst cooled), **other cells**,
**structure** (end plates / base plate / fins / housing), plus the
hottest cell's core rise (q·R_int with a 60 s lag). The BMS sensor
temperature is the hot-node *surface* value (EV5.8.5: sensor on an
electrically conductive surface); the core is reported separately.

| | A: two stacks, passive | B: flat slab, base plate | C: one stack, fins + fan |
|---|---|---|---|
| hot cells | 10/26 (stack centres) | 13/26 (upper layer) | 6/26 (duct outlet) |
| UA hot → struct | 0.15 W/K | 0.3 W/K | 6 W/K |
| UA other → struct | 0.9 W/K | 25 W/K | 30 W/K |
| UA hot ↔ other | 0.6 W/K | 4 W/K | 1 W/K |
| C structure | 1300 J/K | 1100 J/K | 900 J/K |
| UA struct → ambient | 1.0 + 0.12·v^0.8 | 0.8 + 0.35·v^0.8 | 1.0 + 0.1·v^0.8 + 5.5 fan |

All UA/C values are **estimates from geometry** (stack through-plane
conductivity 0.8 W/mK, gap pad 3 W/mK, natural/forced convection). The
most important physical point for concept A: the through-stack diffusion
time is ~2.5 h, so during a 25 min endurance the centre cells of a passive
stack are close to adiabatic.

## 3. Endurance and acceleration (`endurance/`)

* **Track** (`track.ts`): synthetic ~1.08 km lap following the FS endurance
  layout limits (straights ≤ 80 m, hairpins, slaloms, constant turns Ø30–54 m,
  chicanes, decreasing radius). The D chapter is not in the project rules file
  — check against the 2027 PDF. 21 laps ≈ 22.7 km, driver change after lap 10
  (3 min, AIR open, fan off).
* **Vehicle**: quasi-steady lap simulation, 1 m grid. ICE on the rear axle
  (dyno torque curve, CP2 gearbox, best gear, clutch-slip launch), two hub
  motors on the front (Kt from kV 104, 100 A, 10 kW total, field weakening at
  the actual pack voltage), weight transfer, friction ellipse, driver uses
  85 % of μ = 1.6. Regen on the front axle (65 % brake share), limited by
  52.8 A, the cell ceiling 4.40 V and **no regen above 43 °C** (the datasheet
  allows charging only at 0–45 °C, and the BMS opens the AIR otherwise).
* **Energy strategy**: EM deployment factor k (0–1) scales the boost.
  *Auto* finds the largest k that ends at the target SOC (15 %) without a BMS
  trip — the way the team would tune it.
* **BMS** (`bms.ts`, T11.7.7): weakest-cell voltage 500 ms, hottest sensor
  58 °C 1 s (2 °C margin to the 60 °C limit), current limits.

### First results (defaults, T_amb 30 °C, start 95 % SOC)

| Concept | k (auto) | I_rms | I_peak | T sensor max | T core max | lap gain vs ICE only |
|---|---|---|---|---|---|---|
| A | 0.87 | 65 A | 163 A | 53.4 °C | 55.1 °C | 0.46 s |
| B | 0.91 | 68 A | 171 A | 48.1 °C | 50.0 °C | 0.48 s |
| C | 0.97 | 73 A | 183 A | 43.0 °C | 45.2 °C | 0.51 s |

Sensitivity for concept A:

| Case | I_rms | T sensor max | SOC end | lap gain |
|---|---|---|---|---|
| k = 0.3 | 29 A | 34.8 °C | 89 % | 0.17 s |
| k = 0.5 | 40 A | 38.3 °C | 68 % | 0.27 s |
| k = 0.7 | 53 A | 44.0 °C | 44 % | 0.38 s |
| k = 1.0 (full boost) | 70 A | **58.2 °C → BMS trip lap 20** | — | 0.52 s |
| auto, ESC limited to 100 A | 56 A | 46.1 °C | 33 % | 0.46 s |
| auto, T_amb 35 °C | 61 A | 54.9 °C | 15 % | 0.44 s |
| auto, T_amb 25 °C | 67 A | 51.7 °C | 15 % | 0.47 s |

Acceleration 75 m (95 % SOC, 25 °C): 3.81 s hybrid vs 3.96 s ICE only,
190 A peak, weakest cell 4.06 V, 6.4 Wh. At 30 % SOC and 5 °C: 3.82 s,
198 A, weakest cell 3.25 V — no trip.

**Reading:** with full boost the endurance RMS current is 65–75 A, well
above the 40 A that the concept document took as safe for passive cooling.
Passive concept A reaches the 58 °C BMS limit at full boost, and stays
below it only because the energy strategy (k ≈ 0.87) or regen blocked above
43 °C limits it. Limiting the ESC current to ~100 A gives the same lap time
as unlimited auto mode with ~7 °C less, because the lap gain comes from
many medium boosts, not from the 160–190 A peaks.

## 4. Known limitations

* OCV curve, R(T, SOC), RC split and all thermal UA/C are estimates.
* No rate-dependent capacity loss, no hysteresis, no cell-to-cell thermal
  coupling beyond the 3 nodes, no tab/busbar hot spot at the sensor.
* Lap is synthetic; driver behaviour is a single grip factor; no
  tyre-temperature or fuel-mass change; gear shifts are instantaneous.
* ESC/motor efficiency is a constant (0.85 drive / 0.75 regen).
* ICE torque curve is the 2025 dyno curve; fuel uses a flat 300 g/kWh BSFC.

## 5. Tests that would calibrate the model

1. **One cell, C/10 charge + discharge at 25 °C** → OCV table (replace
   `OCV_CELL_V` in `cellData.ts`).
2. **HPPC pulse test** (e.g. 10 s 5C / 40 s rest, every 10 % SOC) at 0, 25,
   45 °C → R0, R1/τ1, R2/τ2 and the Arrhenius energies.
3. **Built stack heating test**: 20 min constant current (e.g. 60 A pack)
   with a thermocouple on a centre cell and on an end plate, then 30 min
   cool-down → hot-node UA and C for the chosen concept.
4. **Endurance data log** from a test day: replace the synthetic lap with
   the measured speed trace and compare HSC current and temperatures.
