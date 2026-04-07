export const F = 96485.33;
export const R_GAS = 8.31446;
export const T_REF = 298.15;

// LiCoO2 positive electrode
export const D_S_POS = 1.0e-14;
export const R_P_POS = 10e-6;
export const K_POS = 2.334e-11;
export const C_MAX_POS = 51410;
export const EPS_POS = 0.50;
export const L_POS = 80e-6;
export const X_POS_100 = 0.49;
export const X_POS_0 = 0.99;

// Graphite negative electrode
export const D_S_NEG = 3.9e-14;
export const R_P_NEG = 10e-6;
export const K_NEG = 1.764e-11;
export const C_MAX_NEG = 30555;
export const EPS_NEG = 0.58;
export const L_NEG = 88e-6;
export const X_NEG_0 = 0.17;
export const X_NEG_100 = 0.81;

export const ALPHA = 0.5;
export const C_E = 1000;
export const DU_DT_POS = -5e-5;
export const DU_DT_NEG = 3e-5;
export const E_D = 5000;
export const E_K = 20000;
export const A_POS = 3 * EPS_POS / R_P_POS;
export const A_NEG = 3 * EPS_NEG / R_P_NEG;

// A_cell calculated from cell capacity so SPM diffusion scales correctly
// Q_cell = F * c_max_pos * eps_pos * L_pos * A_cell * (x_pos_0 - x_pos_100)
export const A_CELL = (6.6 * 3600) / (F * C_MAX_POS * EPS_POS * L_POS * (X_POS_0 - X_POS_100));
