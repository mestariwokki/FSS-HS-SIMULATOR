const MONO: React.CSSProperties = {
  fontFamily: "'IBM Plex Mono', 'Courier New', monospace",
  color: 'var(--accent-em)',
  fontSize: '12px',
  lineHeight: 2.0,
};

const HEADING: React.CSSProperties = {
  fontSize: '10px',
  color: 'var(--text-dim)' as unknown as string,
  textTransform: 'uppercase',
  letterSpacing: '2px',
  borderBottom: '1px solid var(--border-dim)' as unknown as string,
  paddingBottom: '5px',
  marginBottom: '12px',
  marginTop: '24px',
};

const DESC: React.CSSProperties = {
  fontSize: '13px',
  color: 'var(--text-secondary)' as unknown as string,
  lineHeight: 1.8,
  marginBottom: '10px',
};

export function FormulasTab() {
  return (
    <div style={{ maxWidth: '900px' }}>
      <h2 style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: 'normal', marginBottom: '8px' }}>
        Simulation Formulas Reference
      </h2>
      <p style={{ ...DESC, marginBottom: '20px' }}>
        This page documents the key equations used in the battery and motor simulation.
        The battery model is based on the Single Particle Model (SPM) with Ramadass 2004 parameters
        for a LiCoO2/Graphite cell.
      </p>

      {/* OCV */}
      <div style={HEADING}>Open Circuit Voltage (OCV)</div>
      <p style={DESC}>
        Half-cell potentials as a function of stoichiometry (x), fitted from PyBaMM Ramadass2004:
      </p>
      <div style={MONO}>
        U_pos(x) = -10.72x^4 + 23.88x^3 - 16.77x^2 + 2.595x + 4.563<br />
        U_neg(x) = 0.1493 + 0.8493*exp(-61.79x) + 0.3824*exp(-665.8x)<br />
        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;- exp(39.42x - 41.92) - 0.03131*atan(25.59x - 4.099)<br />
        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;- 0.009434*atan(32.49x - 15.74)<br />
        OCV_cell(SOC) = U_pos(x_pos) - U_neg(x_neg)<br />
        x_pos = x_pos_0 + (x_pos_100 - x_pos_0) * SOC<br />
        x_neg = x_neg_0 + (x_neg_100 - x_neg_0) * SOC
      </div>

      {/* SPM */}
      <div style={HEADING}>Single Particle Model (SPM)</div>
      <p style={DESC}>
        Solid-state diffusion averaged to surface concentration, Butler-Volmer kinetics:
      </p>
      <div style={MONO}>
        c_surf = c_avg - (I * R_p) / (5 * F * D_s * eps * L * A_cell)<br />
        j0 = F * k * sqrt(c_e * c_surf * (c_max - c_surf))<br />
        eta = (2RT / F) * arcsinh(I / (2 * j0 * A_elec))<br />
        dc_avg/dt = -I / (F * eps * L * A_cell)
      </div>
      <p style={DESC}>
        Arrhenius temperature correction for D_s and k:
      </p>
      <div style={MONO}>
        D_s(T) = D_s_ref * exp(E_D/R * (1/T_ref - 1/T))<br />
        k(T) = k_ref * exp(E_k/R * (1/T_ref - 1/T))
      </div>

      {/* ECM */}
      <div style={HEADING}>Equivalent Circuit Model (2RC Thevenin)</div>
      <div style={MONO}>
        V_t = V_OC - I*R_pack - V_RC1 - V_RC2 - eta_pos - eta_neg<br />
        V_RC1(k+1) = V_RC1(k)*exp(-dt/tau1) + I*R1*(1-exp(-dt/tau1))<br />
        V_RC2(k+1) = V_RC2(k)*exp(-dt/tau2) + I*R2*(1-exp(-dt/tau2))
      </div>

      {/* Thermal */}
      <div style={HEADING}>Thermal Model</div>
      <div style={MONO}>
        Q_joule = I^2 * R_pack<br />
        Q_rev = I * T * (dU_pos/dT - dU_neg/dT)<br />
        dT/dt = (Q_joule + Q_rev - UA*(T - T_amb)) / mCp
      </div>

      {/* Coulomb counting */}
      <div style={HEADING}>Coulomb Counting</div>
      <div style={MONO}>
        SOC(k+1) = SOC(k) - I*dt / (3600 * Q_eff)<br />
        Q_eff = Q_nom * SoH_cap<br />
        SoH_cap = 1 - kQ * sqrt(cycles)<br />
        SoH_res = 1 + kR * sqrt(cycles)
      </div>

      {/* Motor */}
      <div style={HEADING}>BLDC Motor Model</div>
      <div style={MONO}>
        Kt = 60 / (2*pi*kV) [Nm/A]<br />
        V_bemf = omega / kV_rad<br />
        T_motor = Kt * I_motor<br />
        P_elec = V_bemf * I_m + I_m^2 * R_w [per motor]<br />
        P_bat = (P_elec * n_motors) / eta_esc<br />
        I_bat: V_oc*I - I^2*R_pack = P_bat (quadratic)
      </div>

      {/* Vehicle dynamics */}
      <div style={HEADING}>Vehicle Dynamics</div>
      <div style={MONO}>
        F_drag = 0.5 * rho * CdA * v^2<br />
        F_roll = Crr * m * g<br />
        F_traction = T_wheel * n_motors / r_wheel<br />
        a = (F_traction - F_drag - F_roll) / m
      </div>

      {/* Traction limit */}
      <div style={HEADING}>Traction Limit (Dynamic Axle Load Transfer)</div>
      <div style={MONO}>
        W_rear = m*g*(1 - f_front) + m*a*h_cg/wheelbase<br />
        F_max = mu * W_rear [RWD]<br />
        F_el_use = min(F_el_avail, F_max)
      </div>

      {/* Endurance */}
      <div style={HEADING}>Endurance Energy Budget</div>
      <div style={MONO}>
        E_lap = n_corners * (E_accel + E_brake + E_corner) + E_straight<br />
        E_usable = Q_eff * V_nom * (SOC_0 - 20%) / 100<br />
        laps_possible = E_usable / E_net_per_lap<br />
        E_net = E_lap - E_ICE_per_lap
      </div>

      <div style={{ marginTop: '30px', fontSize: '11px', color: '#555' }}>
        Reference: Ramadass et al. (2004), PyBaMM parameter set. Single particle approximation with
        solid-phase diffusion and Butler-Volmer kinetics. 2RC Thevenin ECM for transient response.
      </div>
    </div>
  );
}
