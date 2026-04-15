export interface TooltipDef {
  abbr: string;
  name: string;
  description: string;
  formula?: string;
  unit: string;
  range: string;
}

const T: Record<string, TooltipDef> = {
  // ── Battery ──────────────────────────────────────────────────────────────
  V_batt: {
    abbr: 'V_batt',
    name: 'Total pack voltage',
    description: 'Calculated by multiplying the single-cell voltage by the number of cells in series. Drops during discharge as current increases.',
    formula: 'V_batt = V_cell × S',
    unit: 'V',
    range: '35–58 V (13S LiCoO₂)',
  },
  V_oc: {
    abbr: 'V_oc',
    name: 'Open Circuit Voltage',
    description: 'Pack voltage when no current flows. Depends on SOC and cell chemistry — the purest indicator of the battery\'s actual energy state.',
    formula: 'Determined from OCV–SOC curve',
    unit: 'V',
    range: '36–57 V (13S, SOC 0–100 %)',
  },
  SOC: {
    abbr: 'SOC',
    name: 'State of Charge',
    description: 'Shows what percentage of the battery capacity remains. 100 % = full, 0 % = empty. Calculated by integrating current over time.',
    formula: 'SOC = SOC₀ − ∫I dt / Q_nom',
    unit: '%',
    range: '0–100 %',
  },
  I_batt: {
    abbr: 'I_batt',
    name: 'Battery current',
    description: 'Positive = discharge (motor draws current), negative = charge (regen braking returns energy). High current heats the battery.',
    unit: 'A',
    range: '−50–250 A (typical)',
  },
  P_loss: {
    abbr: 'P_loss',
    name: 'Power loss',
    description: 'The battery\'s internal resistance converts part of the energy to heat. Increases with the square of current — doubling current quadruples the loss.',
    formula: 'P_loss = I² × R_int',
    unit: 'W',
    range: '0–1 000 W',
  },
  T_batt: {
    abbr: 'T_batt',
    name: 'Battery pack temperature',
    description: 'Rises due to power loss. Excessively high temperature shortens pack life and can cause a safety hazard.',
    formula: 'dT/dt = P_loss / (m×Cp) − cooling',
    unit: '°C',
    range: '20–60 °C (safe operating range)',
  },
  eta: {
    abbr: 'η (eta)',
    name: 'Efficiency',
    description: 'Shows what fraction of the input energy is converted to useful work. The rest is lost as heat in the motor, ESC, and wiring.',
    formula: 'η = P_mech / P_bat',
    unit: '',
    range: '0.70–0.95',
  },
  SoH_cap: {
    abbr: 'SoH_cap',
    name: 'State of Health — capacity',
    description: 'Shows what fraction of the battery\'s original capacity remains after ageing. 100 % = new, 80 % = typical end-of-life threshold.',
    formula: 'SoH_cap = 1 − kQ × cycles',
    unit: '%',
    range: '80–100 % (in use)',
  },
  SoH_res: {
    abbr: 'SoH_res',
    name: 'State of Health — internal resistance',
    description: 'Describes how much the battery\'s internal resistance has grown with ageing. Increasing resistance reduces power capability and adds thermal losses.',
    formula: 'SoH_res = 1 + kR × cycles',
    unit: '',
    range: '1.00–1.50',
  },

  // ── Motor / ESC ──────────────────────────────────────────────────────────
  kV: {
    abbr: 'kV',
    name: 'Motor constant (speed/volt)',
    description: 'How many revolutions per minute the motor spins per volt at no load. Low kV = high torque, high kV = high speed.',
    formula: 'Kt = 60 / (2π × kV)',
    unit: 'RPM/V',
    range: '50–500 RPM/V (FSO applications)',
  },
  Kt: {
    abbr: 'Kt',
    name: 'Torque constant',
    description: 'How much torque is produced per ampere. The link between the electrical and mechanical domains: larger Kt → more torque for the same current.',
    formula: 'Kt = 60 / (2π × kV) = 9.549 / kV',
    unit: 'Nm/A',
    range: '0.02–0.3 Nm/A',
  },
  P_cont: {
    abbr: 'P_cont',
    name: 'Continuous power',
    description: 'The maximum power the motor or battery can deliver for extended periods without overheating. Peak power is only permitted in short bursts (typically ≤ 5 s).',
    unit: 'kW',
    range: '2–10 kW (BLDC, FSO)',
  },
  P_peak: {
    abbr: 'P_peak',
    name: 'Peak power',
    description: 'Short-term maximum power the motor can deliver without immediate damage. Limited by the current limiter: once 5 s of peak current has been used, power returns to continuous level.',
    unit: 'kW',
    range: '4–20 kW (BLDC, FSO)',
  },
  I_cont: {
    abbr: 'I_cont',
    name: 'Continuous current',
    description: 'The maximum current the motor can handle continuously. If exceeded, the motor starts to overheat. The simulator limits current to this value after a peak burst.',
    unit: 'A',
    range: '60–150 A (FSO BLDC)',
  },
  I_peak: {
    abbr: 'I_peak',
    name: 'Peak current',
    description: 'Briefly permitted maximum current. The boost timer tracks time — once peak current has been used for 5 s, I_limit drops to I_cont level.',
    unit: 'A',
    range: '80–200 A (FSO BLDC)',
  },
  eta_ESC: {
    abbr: 'η_ESC',
    name: 'ESC efficiency',
    description: 'Fraction of battery energy that reaches the motor. The rest is lost as heat in the ESC transistors and wiring.',
    unit: '',
    range: '0.92–0.98',
  },
  eta_motor: {
    abbr: 'η_motor',
    name: 'Motor efficiency',
    description: 'Fraction of electrical power converted to mechanical power. Winding losses (I²R) and iron losses consume part of the input.',
    unit: '',
    range: '0.85–0.95',
  },
  eta_regen: {
    abbr: 'η_regen',
    name: 'Regenerative efficiency',
    description: 'Fraction of braking energy returned to the battery. The rest is lost as heat in the ESC and motor windings.',
    unit: '',
    range: '0.75–0.90',
  },

  // ── ICE ──────────────────────────────────────────────────────────────────
  rpm: {
    abbr: 'RPM',
    name: 'Engine speed (Revolutions Per Minute)',
    description: 'Rotational speed of the engine shaft. Affects both torque (non-linearly, following the curve) and power.',
    formula: 'P = T × ω = T × RPM × 2π/60',
    unit: 'RPM',
    range: '500–11 000 RPM (MT-07)',
  },
  bsfc: {
    abbr: 'BSFC',
    name: 'Brake Specific Fuel Consumption',
    description: 'How many grams of fuel the engine consumes to produce one kilowatt-hour of energy. Lower = more efficient.',
    formula: 'BSFC = ṁ_fuel / P_shaft',
    unit: 'g/kWh',
    range: '230–400 g/kWh (petrol engines)',
  },
  ice_torque: {
    abbr: 'T_ice',
    name: 'ICE torque',
    description: 'The rotational force produced by the engine at a given speed. Read from the speed–torque curve by interpolation.',
    unit: 'Nm',
    range: '50–68 Nm (MT-07 690cc)',
  },

  // ── Vehicle ───────────────────────────────────────────────────────────────
  CdA: {
    abbr: 'CdA',
    name: 'Aerodynamic drag area',
    description: 'Drag coefficient Cd multiplied by the vehicle frontal area A. Describes the magnitude of aerodynamic drag — smaller = less drag.',
    formula: 'F_drag = ½ × ρ_air × CdA × v²',
    unit: 'm²',
    range: '0.25–0.60 m² (Formula Student)',
  },
  Crr: {
    abbr: 'Crr',
    name: 'Rolling resistance coefficient',
    description: 'Describes tyre rolling resistance. A lower value means less energy loss. Depends on the tyre, pressure, and surface.',
    formula: 'F_roll = Crr × m × g',
    unit: '',
    range: '0.010–0.025 (asphalt track)',
  },
  mu: {
    abbr: 'μ (mu)',
    name: 'Friction coefficient',
    description: 'Coefficient of friction between the tyre and the surface. Limits the force available during acceleration — determines the slip threshold.',
    unit: '',
    range: '1.2–2.0 (slick tyre, dry track)',
  },
  gear_ratio: {
    abbr: 'i_gear',
    name: 'Gear ratio',
    description: 'Ratio of engine shaft speed to wheel shaft speed. High gear ratio = more wheel torque, lower wheel speed.',
    formula: 'T_wheel = T_motor × i_gear × η_mech',
    unit: ':1',
    range: '2–8:1 (Formula Student)',
  },

  // ── SPM / electrochemistry ────────────────────────────────────────────────
  V_RC: {
    abbr: 'V_RC',
    name: 'RC element voltage drop (2RC Thevenin)',
    description: 'Voltage across the battery model\'s RC element, representing the slow voltage drop caused by diffusion. Recovers slowly when current ceases.',
    formula: 'V_RC(t+dt) = V_RC(t)·e^(−dt/τ) + I·R·(1−e^(−dt/τ))',
    unit: 'V',
    range: '0–2 V (short-term spikes)',
  },
  eta_pos: {
    abbr: 'η_pos',
    name: 'Positive electrode overpotential (Butler-Volmer)',
    description: 'Electrochemical overpotential describing how much the cell voltage deviates from equilibrium under current flow. Loads the battery.',
    unit: 'V',
    range: '0–0.1 V',
  },
  xp: {
    abbr: 'x_p',
    name: 'Lithium concentration — positive electrode',
    description: 'Relative concentration of lithium ions in the positive electrode lattice. 1 = full, 0 = empty. Drives the open-circuit voltage.',
    unit: '',
    range: '0.45–0.97 (LiCoO₂)',
  },
};

export default T;
