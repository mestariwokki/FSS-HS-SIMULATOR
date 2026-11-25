# Codex task: research best design practices for LV battery packs (Formula Student hybrid HSC)

> **Type:** research only. Do not change application code in `src/`.
> **Output:** one Markdown report, `docs/research/lv-battery-design-practices.md`, plus an
> optional `docs/research/sources.csv`. Open a pull request with those files only.
> **Language:** write the report in English, but add a short Finnish summary
> ("Tiivistelmä") at the top so the team can skim it.

## 1. Why we need this

Formula Student Oulu (FSO) builds the **M06H Aurora** combustion hybrid for the FSG 2027
season (hybrid class "HY", part of the CV class). The hybrid stores energy in a
**Hybrid System Container (HSC)**, a low-voltage lithium pouch pack. The 2026 HSC was never
tested, and the team is now redesigning it (HSC v3). We want an evidence-based list of
**best design practices for LV (≤ 60 V DC) lithium battery packs**, with special weight on
material from **Formula Student hybrid teams** and FS accumulator design in general, that
we can apply directly in the HSC v3 design.

## 2. Our current design (context for judging what is relevant)

| Item | Value |
|---|---|
| Cells | 26 × EP9343126VVP LiCoO2 pouch cells (EP Power), 4.45 V max, 2.60 V cut-off |
| Configuration | 13S2P, max ≈ 57.85 V (must stay ≤ 60 V DC), cell mass ≈ 2.65 kg (rule limit 3 kg) |
| Cell current limits (datasheet) | ~198 A continuous / 330 A 3 s discharge per 2P pack; charge/regen much lower |
| Mechanical (HSC v3 draft) | two stacks (7 + 6 cell pairs), CFRP FR-epoxy end plates with M4 tie rods and foam for **cell compression**, G10 lower plates and bridges, Al busbars + Al push bars clamping the tabs, CFRP shell, 3D-printed FR parts for ducts |
| Thermal | air cooled: Al fins between cell pairs, 12 V radial blower (from car LVS), front air intake, plenum under the cells |
| Sensing | **8 NTC sensors** placed ~5 mm from the tab exit (FSG 2027 EV5.8) |
| BMS | ENNOID BMS Master-LV (STM32F303, ISL28022 current sensing with 100 µΩ shunt, isoSPI, CAN) + our own LTC6813 slave board (13 cell taps, passive balancing) |
| Switching / protection | AIR (Altran AEV250 planned) on the positive pole inside the HSC, main fuse (must be ≤ cell max discharge current per T11.7.7) |
| Drive | 2 × VESC-based ESCs, 2 × Neumotors 6530 hub motors on the front wheels |
| Targets | HSC ≈ 6 kg total, reliable and simple, hybrid running by end of Jan 2027 |

**Team design principles** (rank recommendations against these):
1. Simple over clever. Fewer parts, fewer custom PCBs.
2. Reliable and inspectable. Must pass FSG technical inspection on the first try.
3. Documented. Every choice must be traceable to a rule, a datasheet or a test.
4. Buy over build when a proven off-the-shelf part exists at a student budget (~8000 € total hybrid budget).

## 3. Rules that bound the design (FSG / FS Rules 2027)

Read the official rules yourself; do not rely on this summary for final wording:
- FS Rules 2027 v1.0: https://www.formulastudent.de/fileadmin/user_upload/all/2027/rules/FS_Rules_2027_v1.0.pdf
- FS Rules 2026 v1.1 (older text, same structure): https://www.formulastudent.de/fileadmin/user_upload/all/2026/rules/FS-Rules_2026_v1.1.pdf
- FSG rules page with FAQ (the FAQ counts as rules): https://www.formulastudent.de/fsg/rules/

Key rules for a hybrid HSC:
- **CV5.1.2 / T11.1.2:** whole hybrid is a Low Voltage System, max 60 V DC.
- **CV5.2.1–CV5.2.5:** HSC mounted to primary structure for 40 g / 40 g / 20 g, AIR inside the HSC on the positive pole, cells ≤ 3 kg, wall openings < 25 %, HSC removable for weighing.
- **CV5.1.3:** live parts IPxxB. **CV5.1.6:** firewall to the fuel tank. **CV5.1.8 → EV4.5.15:** high-current connection rules (no soldering on cells, positive locking).
- **T11.7.4–T11.7.6:** rigid casing, overpressure relief, short-circuit protection ≤ 100 mm from terminals. (2027 changed T11.7.2 mounting wording; check it.)
- **T11.7.7:** fire-retardant casing (T1.2.1), overcurrent protection ≤ cell max discharge current, overtemperature on ≥ 30 % of cells per EV5.8, cell voltage protection on all cells, readable values, interruptible sensing for inspection.
- **EV5.8 (reworked in 2027):** temperature sensor < 15 mm from the cell temperature reference point along the high-current path; for pouch cells the reference point is where the negative tab exits the pouch; each monitoring part must be individually triggerable at TI (EV5.8.14).
- **EV5.5.12–EV5.5.14** (EV-only, but we treat them as good practice for pouch cells): fix ≥ 80 % of the large faces with compressible material, no mechanical load through the tabs, ≤ 1.0 MPa compression / 0.05 MPa shear or datasheet values.

Flag anything in your findings that would conflict with these rules.

## 4. Research questions

Answer each topic with **concrete, sourced recommendations** (numbers where they exist), and
say how they apply to our 13S2P pouch HSC.

1. **Cell compression for pouch cells.** Recommended pressure range (kPa / MPa) for LiCoO2 / NMC pouch cells, effect on cycle life and swelling, end-plate + tie-rod vs strap vs housing designs, compressible pads (silicone foam, PU foam such as Rogers PORON / BISCO), how to measure and verify pressure (load cell, pressure film), how much swelling to design for.
2. **Thermal design for air-cooled packs.** Fin vs gap-flow designs, flow distribution along a stack (first vs last cell), fan/blower sizing, acceptable cell-to-cell temperature spread, thermal interface materials and what not to use (glue is not a TIM), simple lumped thermal models.
3. **Busbars and tab joints.** Clamped vs welded (laser/ultrasonic) vs bolted tab joints for pouch cells, Al vs Cu vs Ni-plated busbars, contact pressure and surface prep, joint resistance targets, vibration and creep of aluminium joints, how FS teams do it.
4. **Fusing and protection.** Main fuse selection for a ~200 A LV pack (I²t, DC rating, time-current curve vs cell limits), cell-level or parallel-group fusing for 2P, AIR/contactor selection, short-circuit protection placement, precharge for a 60 V pack driving ESC capacitors.
5. **BMS and sensing.** Cell voltage tap wiring and fusing, NTC placement on pouch tabs and mounting methods that pass EV5.8, sensor count vs 30 % rule, balancing strategy, current sensing, fault timing (500 ms voltage, 1 s temperature), plausibility checks, and experience with ENNOID or LTC681x-based BMS in FS.
6. **Enclosure and fire materials.** What counts as fire retardant for FSG (UL94 V-0 at the used thickness, FR-epoxy CFRP, G10/FR4, FR-ABS / PC prints), venting / overpressure relief designs, firewall materials, insulation (Nomex, Kapton, fishpaper), IPxxB touch protection, mounting for 40 g.
7. **Formula Student hybrid and FS accumulator material.** Find public design reports, theses, Hybrid System Forms, team wikis, conference papers or talks from **FS hybrid teams** (FSG HY class, FS Austria, FS UK, etc.) and good FS EV accumulator documentation that transfers to a ≤ 60 V pack. For each, note what they did, what went wrong, and what we can reuse.
8. **Testing and validation.** Tests worth doing before competition for an LV pack: cell matching / capacity test, internal resistance (pulse/HPPC), pack insulation and joint resistance, thermal test under a drive-cycle load, compression measurement, BMS fault-injection checklist for technical inspection.

## 5. Where to look

Prefer primary and reputable sources, in this order:
1. Rules, FAQ and official FSG / FS documents (Academy slides, inspection checklists).
2. Cell and component datasheets and application notes (EP Power, Analog Devices LTC681x, Littelfuse / Eaton / Mersen fuse application guides, TE / Altran contactors, Rogers foam guides).
3. Peer-reviewed papers and theses (pouch cell compression, air-cooled pack thermal design).
4. FS team material: public design reports, GitHub repositories, theses (e.g. university repositories such as Chalmers ODR, TU Delft repository, Aaltodoc, Jultika/Oulu), FS forums, FSAE/FS talks on YouTube.
5. Industry guides (e.g. Battery Design wiki "batterydesign.net", OEM pack design notes).

Avoid unsourced forum claims unless no better source exists, and mark them as such.

## 6. Required output format

`docs/research/lv-battery-design-practices.md` with:
1. **Tiivistelmä (FI):** 10–15 bullets in Finnish, the most important takeaways for HSC v3.
2. **Top 10 recommendations for HSC v3:** each with the recommendation, why, source link(s), effort (low/med/high), and which team principle it supports.
3. **One section per research question (4.1–4.8)** with findings, numbers, and inline source links like `[Author/Org, year](URL)`.
4. **FS hybrid / accumulator source table:** team, year, document type, link, key reusable ideas.
5. **Rule conflicts and open questions:** anything where our current design (section 2) may break a rule or best practice.
6. **Sources:** a numbered list of every URL used, with the date you accessed it.

Rules for the report:
- **Every factual claim needs a link.** If you cannot find a source, say "no source found" instead of guessing.
- Give numbers with units and the conditions they apply to (cell chemistry, format, temperature).
- Separate "what the source says" from "our interpretation for HSC v3".
- Keep it practical: a second-year student engineer should be able to act on it.
- Do not paste large copyrighted text. Short quotes are fine.

## 7. Definition of done

- [ ] `docs/research/lv-battery-design-practices.md` exists and follows section 6.
- [ ] At least 30 distinct sources, at least 5 of them from Formula Student teams or FS organisers.
- [ ] Every research question in section 4 is answered or marked as "no good source found".
- [ ] No changes outside `docs/research/`.
- [ ] A pull request is open with a short description listing the top 5 findings.
