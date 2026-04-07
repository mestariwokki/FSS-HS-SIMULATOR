import { useCallback, useRef, useState } from 'react';
import type { MotorConfig, PackConfig } from '../types';
import { kVradFromKv } from '../simulation/motor/motorConstants';

export interface EffMapHoverInfo {
  rpm: number;
  torque_Nm: number;
  eta: number;
  P_mech_kW: number;
  I_motor_A: number;
  inBounds: boolean;
  cx: number;
  cy: number;
}

export function useEffMapHover(mc: MotorConfig | null, pack: PackConfig | null) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoverInfo, setHoverInfo] = useState<EffMapHoverInfo | null>(null);

  const PL = 58;
  const PR = 12;
  const PT = 12;
  const PB = 48;

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!mc || !pack) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const cx = (e.clientX - rect.left) * scaleX;
    const cy = (e.clientY - rect.top) * scaleY;

    const cw = canvas.width - PL - PR;
    const ch = canvas.height - PT - PB;

    if (cx < PL || cx > PL + cw || cy < PT || cy > PT + ch) {
      setHoverInfo(null);
      return;
    }

    const rpm_max = mc.kV_rpmV * pack.v_nom;
    const T_max = mc.Kt_NmA * mc.I_peak_A * 1.05;

    const rpm = (cx - PL) / cw * rpm_max;
    const T_mot = (1 - (cy - PT) / ch) * T_max;
    const kV_r = kVradFromKv(mc.kV_rpmV);
    const omega = rpm * 2 * Math.PI / 60;
    const Vb = omega / kV_r;
    const Im = T_mot / mc.Kt_NmA;
    const Pm = T_mot * omega * mc.n_motors;
    const Pb = (Vb * Im + Im * Im * mc.R_winding_Ohm) * mc.n_motors / mc.eta_esc;
    const eta = Pb > 0.5 ? Pm / Pb : 0;
    const inBounds = Im <= mc.I_peak_A && Vb + Im * mc.R_winding_Ohm <= pack.v_max && Vb <= pack.v_nom;

    setHoverInfo({
      rpm, torque_Nm: T_mot, eta, P_mech_kW: Pm / 1000, I_motor_A: Im,
      inBounds, cx, cy,
    });
  }, [mc, pack]);

  const onMouseLeave = useCallback(() => {
    setHoverInfo(null);
  }, []);

  return {
    canvasRef,
    hoverInfo,
    onMouseMove,
    onMouseLeave,
  };
}
