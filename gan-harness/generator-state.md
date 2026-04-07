# Generator State -- Iteration 001

## What Was Built
- Complete React + Vite + TypeScript migration of the FSS-HS-SIMULATOR
- Battery simulation tab with SPM model, 2RC ECM, thermal model, Coulomb counting
- Motor/Drivetrain simulation tab with BLDC motor model, vehicle dynamics, 75m acceleration
- Formulas reference tab with all equations documented
- 5 built-in cell presets with localStorage persistence
- Canvas-based charts (LineChart, EfficiencyMap)
- CSV export for both battery and motor data
- Dark theme UI matching original (#0e0e14 background, accent colors)
- IBM Plex Mono/Sans fonts via Google Fonts

## Files Written
### Simulation Layer (pure TypeScript, no React)
- src/types/index.ts - All interfaces and types
- src/simulation/constants.ts - SPM constants (Ramadass2004)
- src/simulation/ocv.ts - U_pos, U_neg, OCV functions
- src/simulation/spm.ts - Arrhenius, surface concentration, Butler-Volmer
- src/simulation/ecm.ts - SoH calculation, RC step
- src/simulation/thermal.ts - Thermal model
- src/simulation/coulomb.ts - SOC and energy integration
- src/simulation/simStep.ts - Main battery simulation step
- src/simulation/currentControl.ts - CC/profile/CC-CV modes
- src/simulation/shortCircuit.ts - Short circuit calculator
- src/simulation/motor/motorConstants.ts - kV/Kt conversions, defaults
- src/simulation/motor/motorStep.ts - Motor simulation step
- src/simulation/motor/motorThermal.ts - Motor thermal model
- src/simulation/motor/efficiencyMap.ts - Efficiency map calculation
- src/simulation/motor/vehicleDynamics.ts - Vehicle dynamics
- src/simulation/motor/traction.ts - Traction limiting
- src/simulation/motor/iceEngine.ts - ICE engine model
- src/simulation/endurance/enduranceModel.ts - Endurance segment models
- src/simulation/endurance/enduranceSolver.ts - Full endurance solver

### Hooks
- src/hooks/usePresets.ts - Preset management with localStorage
- src/hooks/useBatterySim.ts - Battery simulation loop (rAF)
- src/hooks/useMotorSim.ts - Motor simulation loop (rAF)
- src/hooks/useChartHover.ts - Chart hover interaction
- src/hooks/useEffMapHover.ts - Efficiency map hover

### Components
- src/components/common/ValueBox.tsx, ParamGroup.tsx, PresetSelector.tsx
- src/components/charts/LineChart.tsx, EfficiencyMap.tsx, ChartTooltip.tsx
- src/components/layout/TabNav.tsx, TabPage.tsx
- src/components/battery/BatteryTab.tsx, PackConfigPanel.tsx, SimModePanel.tsx, SoHPanel.tsx, LiveValues.tsx, AlertBar.tsx, OcvTable.tsx, ShortCircuitPanel.tsx
- src/components/motor/MotorTab.tsx, MotorConfigPanel.tsx, EscConfigPanel.tsx, Acc75Panel.tsx, MotorLiveValues.tsx, MotorSummaryTable.tsx, Acc75ResultBox.tsx
- src/components/formulas/FormulasTab.tsx

### App
- src/App.tsx - Main app with tab routing
- src/App.css - Dark theme CSS
- src/main.tsx - Entry point
- src/index.css - Global styles
- index.html - Google Fonts

## Known Issues
- Endurance tab not yet implemented as standalone (solver exists but no UI)
- Chart hover interaction not yet wired up in all charts
- No unit tests yet
- Motor tab duplicates some battery pack config state (could share via context)

## Dev Server
- URL: http://localhost:5173
- Status: running
- Command: npm run dev
