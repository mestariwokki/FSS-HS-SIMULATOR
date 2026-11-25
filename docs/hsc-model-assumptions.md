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
  motors on the front (`motor/emDrive.ts`: Kt from kV 104, 7.5 Nm / 85 A
  motor limit, ESC 86 A cont / 100 A 5 s and 6.88 / 8 kW, copper, iron and
  ESC losses, 2-node motor and 1-node ESC thermal with derating, torque fade
  near no-load speed at the actual pack voltage), weight transfer, friction ellipse, driver uses
  85 % of μ = 1.6. Regen on the front axle (65 % brake share), limited by
  52.8 A, the cell ceiling 4.40 V and **no regen above 43 °C** (the datasheet
  allows charging only at 0–45 °C, and the BMS opens the AIR otherwise).
* **Energy strategy**: EM deployment factor k (0–1) scales the boost.
  *Auto* finds the largest k that ends at the target SOC (15 %) without a BMS
  trip — the way the team would tune it.
* **BMS** (`bms.ts`, T11.7.7): weakest-cell voltage 500 ms, hottest sensor
  58 °C 1 s (2 °C margin to the 60 °C limit), current limits.

### Results (defaults, T_amb 30 °C, start 95 % SOC, hub motors from `motor/emDrive.ts`)

Motor data from the Neumotors 65xx datasheet (6530/8.5/104: Rm 0.086 Ω,
Kt 92 mNm/A, 85 A saturation). With the real winding resistance the drive
runs at ~78 % battery → wheel efficiency, and the motor windings reach the
VESC default motor-temperature limit (85 → 100 °C) after about 10 laps.
From there the VESC cuts the current back (≈ 310 s of derating per race).
The motor temperature, not the HSC or the ESC, limits the boost.

| Concept | I_rms | I_peak | T sensor max | T core max | SOC end |
|---|---|---|---|---|---|
| A | 44 A | 153 A | 39.7 °C | 40.1 °C | 50 % |
| B | 44 A | 153 A | 36.3 °C | 36.8 °C | 50 % |
| C | 44 A | 154 A | 33.8 °C | 34.3 °C | 50 % |

Motor winding max 93 °C, ESC 36 °C. Endurance gain vs ICE only ≈ 7.3 s.
75 m: 3.846 s vs 3.968 s ICE only, 161 A peak.

**Reading:** the HSC has thermal and energy margin left; half the charge is
unused. The motor thermal path (case → hub/upright air) is an estimate, so
measure the winding temperature in a constant-torque run before relying on
the derating time.

### Gear ratio (`node scripts/gear-sweep.mjs 2.5 3 3.5 4`)

Back-EMF per motor with the current 3.0 gear: 7.4 V at 20 km/h, 22 V at
60 km/h, 37 V at 100 km/h, 45 V at 120 km/h (0.37 V per km/h). The HSC
gives 57 V open-circuit at 95 % SOC and 49 V at 20 % SOC.

| Gear | 75 m | v where back-EMF = HSC voltage (95 % / 20 % SOC) | Endurance gain | T sensor A |
|---|---|---|---|---|
| 2.5 | 3.858 s | 183 / 158 km/h | 7.8 s | 42.9 °C |
| 3.0 | 3.840 s | 152 / 131 km/h | 9.3 s | 47.9 °C |
| 3.5 | 3.822 s | 130 / 112 km/h | 10.4 s | 50.5 °C |
| 4.0 | 3.814 s | 114 / 98 km/h | 10.9 s | 47.5 °C |
| 5.0 | 3.814 s | 91 / 79 km/h | 10.2 s | 41.4 °C |

A higher gear gives more force at low speed but the motor runs out of
voltage earlier. Above the speed where back-EMF exceeds the HSC voltage, the
ESC body diodes rectify and the motor charges the HSC uncontrolled (charge
current and the 45 °C charge limit). The car reaches about 118 km/h at
75 m and 106 km/h in endurance, so a gear of about 3.5 is the most that
keeps margin in both. The model fades motor torque linearly over the last
20 % below no-load speed; the real VESC limit is not measured.

### HSC v2 rev0.2 (`HSC_CONCEPTS.V2`, `node scripts/hsc-v2-scenarios.mjs`)

Current design from `hybrid/hsc-v2/HSC-v2-suunnittelu.md`: 5.8 kg (car mass
+1.3 kg in these runs), 0.8 mm Al fin per cell pair, 60 mm fan across a
plenum. Fin conduction to the plenum limits the cooling path to about
0.65 W/K (~25 W at 30 K, as the design doc estimates), so over a 25 min
endurance the cells' own heat capacity matters more than the fan.
Hub motors and VESC_FSO as in `emDrive.ts` (FDD86367-F085, 4 per switch,
4.2 mΩ max each → R_esc ≈ 3–4 mΩ incl. shunt and PCB).

| Case | I_rms | I_peak | T sensor max | SOC end | Motor max | Derated | Endurance gain |
|---|---|---|---|---|---|---|---|
| 30 °C | 44 A | 153 A | 38.5 °C | 50 % | 93 °C | 314 s | 7.3 s |
| 35 °C | 42 A | 152 A | 41.8 °C | 53 % | 93 °C | 333 s | 7.0 s |
| 30 °C, fan failure | 44 A | 153 A | 38.9 °C | 50 % | 93 °C | 314 s | 7.3 s |
| 30 °C, motor limit 85 A (saturation) | 44 A | 161 A | 38.6 °C | 50 % | 93 °C | 323 s | 7.5 s |
| 30 °C, VESC motor-temp limit 130 → 150 °C | 61 A | 180 A | 48.5 °C | 20 % | 138 °C | 178 s | 8.5 s |
| 30 °C, VESC limited to 60 A | 41 A | 113 A | 37.7 °C | 53 % | 90 °C | 221 s | 6.2 s |
| 30 °C, gear 3.5 | 48 A | 164 A | 40.3 °C | 47 % | 92 °C | 253 s | 8.4 s |
| 30 °C, motor + VESC 120 A | 46 A | 198 A | 39.4 °C | 49 % | 95 °C | 331 s | 9.3 s |

75 m: 3.846 s (ICE only 3.968 s); 85 A 3.842 s; VESC 60 A 3.878 s;
gear 3.5 3.830 s; 120 A 3.798 s at the 198 A HSC limit; 120 A + gear 3.5
3.776 s.

### Configuration search (`node scripts/optimise-hybrid.mjs 150`, full output in `optimisation-2026-11-25.txt`)

672 configurations: hub gear 2.5–4.0, VESC motor current for the short
events (75 m + autocross) and for endurance 60–120 A (torque saturates above
85 A, k_sat 0.3–0.7), VESC motor-temperature limit 85–100 … 130–145 °C.
Scored as FS points (acceleration 50, autocross 100, endurance 250; assumed
winner times 3.6 s / 60 s / 1300 s). A configuration is infeasible if the
BMS trips, the winding passes 160 °C, or back-EMF reaches the HSC voltage
within 5 km/h of the top speed (75 m at full charge, endurance at the end
SOC). Monte Carlo over 10 uncertain inputs (motor cooling ×0.5–1.5, winding
→ case R, Rm ±10 %, k_sat, Io, ESC R and cooling, HSC UA ×0.6–1.4, cell R
×0.9–1.3, T_amb 20–35 °C), 150 samples, common random numbers.

| Configuration | Mean gain vs HSF baseline | P10 | Infeasible |
|---|---|---|---|
| gear 3.25, 120 A / 120 A, 85–100 °C | +2.46 pts | +1.92 | 37 % (back-EMF) |
| **gear 3.0, 120 A / 120 A, 115–130 °C** | **+1.87 pts** | **+1.30** | **0 %** |
| gear 3.0, 120 A / 120 A, 130–145 °C | +1.86 pts | +1.24 | 0 % (motor P90 140 °C) |
| gear 2.75, 120 A / 120 A, 130–145 °C | +1.02 pts | +0.47 | 0 % |
| baseline gear 3.0, 86 A / 86 A, 85–100 °C | 0 | 0 | 0 % |

Gears 3.5 and above are infeasible in the nominal case. 1 kg of car mass is
worth about 0.3 pts (0.25 s endurance, 4 ms in the 75 m).

### VESC_FSO R2 data (design report + PCB HW test report, 2026-11-25)

* ESC cooling now from the R2 heat-sink calculator: passive junction-to-ambient
  0.28–0.59 W/K over sink options 1–4 (0.7–1.3 W/K only with 30 km/h forced
  air; the VESCs sit out of the airflow). Default 0.5 W/K (option 1), Monte
  Carlo 0.28–0.59 W/K. Heat capacity 250 J/K (estimate, sink top + bottom).
* FET Rds(on) temperature coefficient +0.38 %/K (FDD86367-F085, 4.2 → 6.6 mΩ).
* Result: ESC max 47 °C (recommended setup, 30 °C), under the VESC 85 °C
  derate start and the 112 °C Tj target even at the worst sink option. The
  ranking and points of the configuration search did not change; the motor
  winding remains the limit.
* The PCB HW test report covers shorts and supply rails only (3 of 5 DUTs
  filled in), so the power stage is still unmeasured.
* HSC peak current in endurance is about 180–200 A at high speed, not 250 A
  at standstill: at low speed the phase current is high but the battery
  current (≈ P/V) is low.

## 4. Known limitations

* OCV curve, R(T, SOC), RC split and all thermal UA/C are estimates.
* No rate-dependent capacity loss, no hysteresis, no cell-to-cell thermal
  coupling beyond the 3 nodes, no tab/busbar hot spot at the sensor.
* Lap is synthetic; driver behaviour is a single grip factor; no
  tyre-temperature or fuel-mass change; gear shifts are instantaneous.
* Motor copper/iron loss from the Neumotors datasheet; torque saturation above 85 A, motor and ESC thermal parameters (`emDrive.ts`) are estimates.
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
