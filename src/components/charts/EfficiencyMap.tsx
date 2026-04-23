import { useEffect, useRef } from 'react';
import type { MotorConfig, PackConfig, MotorDataPoint } from '../../types';
import { kVradFromKv } from '../../simulation/motor/motorConstants';
import { etaColor } from '../../simulation/motor/efficiencyMap';

interface EfficiencyMapProps {
  mc: MotorConfig;
  pack: PackConfig;
  lastPoint?: MotorDataPoint | null;
  hoverPx?: { cx: number; cy: number } | null;
}

export function EfficiencyMap({ mc, pack, lastPoint, hoverPx }: EfficiencyMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const W = canvas.offsetWidth || 600;
    const H = 280;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const PL = 58, PR = 12, PT = 12, PB = 48;
    const cw = W - PL - PR;
    const ch = H - PT - PB;

    const kV_rad = kVradFromKv(mc.kV_rpmV);
    const rpm_max = mc.kV_rpmV * pack.v_nom;
    const T_max = mc.Kt_NmA * mc.I_peak_A * 1.05;

    const xFromRPM = (rpm: number) => PL + (rpm / rpm_max) * cw;
    const yFromT = (t: number) => PT + ch * (1 - t / T_max);

    // Background
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, W, H);

    // Grid 80x50
    const NX = 80, NY = 50;
    const cellW = cw / NX, cellH = ch / NY;

    for (let ix = 0; ix < NX; ix++) {
      const rpm = (ix + 0.5) / NX * rpm_max;
      const omega = rpm * 2 * Math.PI / 60;
      const V_bemf = omega / kV_rad;

      for (let iy = 0; iy < NY; iy++) {
        const T_motor = (1 - (iy + 0.5) / NY) * T_max;
        const I_motor = T_motor / mc.Kt_NmA;

        if (I_motor > mc.I_peak_A || V_bemf + I_motor * mc.R_winding_Ohm > pack.v_max || V_bemf > pack.v_nom) {
          ctx.fillStyle = 'rgba(255,255,255,0.03)';
          ctx.fillRect(PL + ix * cellW, PT + iy * cellH, cellW + 0.5, cellH + 0.5);
          continue;
        }

        const P_mech = T_motor * omega * mc.n_motors;
        const P_bat = (V_bemf * I_motor + I_motor * I_motor * mc.R_winding_Ohm) * mc.n_motors / mc.eta_esc;
        const eta = P_bat > 0.1 ? P_mech / P_bat : 0;

        ctx.fillStyle = etaColor(eta);
        ctx.fillRect(PL + ix * cellW, PT + iy * cellH, cellW + 0.5, cellH + 0.5);
      }
    }

    // I_peak line
    const T_ipeak = mc.Kt_NmA * mc.I_peak_A;
    const y_ip = yFromT(T_ipeak);
    if (y_ip >= PT && y_ip <= PT + ch) {
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);
      ctx.moveTo(PL, y_ip);
      ctx.lineTo(PL + cw, y_ip);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.font = '9px monospace';
      ctx.fillText(`I_peak ${mc.I_peak_A}A`, PL + 4, y_ip - 3);
    }

    // P_cont hyperbola
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255,202,40,0.70)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    let first = true;
    for (let ix = 2; ix < NX; ix++) {
      const rpm = (ix + 0.5) / NX * rpm_max;
      const omega = rpm * 2 * Math.PI / 60;
      const T_c = (mc.P_cont_kW * 1000) / omega;
      if (T_c > T_max || T_c < 0.05) continue;
      const x = xFromRPM(rpm), y = yFromT(T_c);
      if (first) { ctx.moveTo(x, y); first = false; } else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Axes
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PL, PT);
    ctx.lineTo(PL, PT + ch);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(PL, PT + ch);
    ctx.lineTo(PL + cw, PT + ch);
    ctx.stroke();

    ctx.font = '11px monospace';
    ctx.fillStyle = '#bbb';
    for (let rpm = 0; rpm <= rpm_max + 1; rpm += 500) {
      const x = xFromRPM(rpm);
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255,255,255,0.07)';
      ctx.lineWidth = 0.5;
      ctx.moveTo(x, PT);
      ctx.lineTo(x, PT + ch);
      ctx.stroke();
      ctx.fillStyle = '#bbb';
      const lbl = rpm === 0 ? '0' : (rpm >= 1000 ? (rpm / 1000).toFixed(1) + 'k' : rpm + '');
      ctx.textAlign = 'center';
      ctx.fillText(lbl, x, PT + ch + 18);
    }

    ctx.fillStyle = '#ddd';
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('RPM', PL + cw / 2, PT + ch + 36);

    for (let T = 0; T <= T_max + 0.05; T += 1.0) {
      const y = yFromT(T);
      if (y < PT || y > PT + ch + 1) continue;
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255,255,255,0.07)';
      ctx.lineWidth = 0.5;
      ctx.moveTo(PL, y);
      ctx.lineTo(PL + cw, y);
      ctx.stroke();
      ctx.fillStyle = '#bbb';
      ctx.font = '11px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(T.toFixed(1), PL - 7, y + 4);
    }

    ctx.save();
    ctx.translate(13, PT + ch / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = '#ddd';
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Torque (Nm)', 0, 0);
    ctx.restore();

    // Legend
    const legendItems = [
      { col: '#66bb6a', label: 'eta >= 85%' },
      { col: '#ffca28', label: 'eta 70-85%' },
      { col: '#ef5350', label: 'eta < 70%' },
    ];
    const lx = PL + 8, ly = PT + 8;
    ctx.fillStyle = 'rgba(0,0,0,0.68)';
    ctx.fillRect(lx - 7, ly - 7, 108, legendItems.length * 15 + 7);
    ctx.font = '10px monospace';
    legendItems.forEach((item, i) => {
      const y = ly + i * 15;
      ctx.fillStyle = item.col;
      ctx.fillRect(lx, y, 9, 9);
      ctx.fillStyle = '#ccc';
      ctx.textAlign = 'left';
      ctx.fillText(item.label, lx + 13, y + 8);
    });

    // Hover crosshair
    if (hoverPx) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 0.8;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(hoverPx.cx, PT);
      ctx.lineTo(hoverPx.cx, PT + ch);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(PL, hoverPx.cy);
      ctx.lineTo(PL + cw, hoverPx.cy);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // Operating point
    if (lastPoint && Math.abs(lastPoint.RPM) > 0) {
      const d_rpm = Math.abs(lastPoint.RPM);
      const d_T = Math.abs(lastPoint.T_wheel) / Math.max(mc.gear_ratio * 0.97, 0.01);
      const rpm_c = Math.max(rpm_max * 0.01, Math.min(rpm_max * 0.99, d_rpm));
      const T_c = Math.max(T_max * 0.01, Math.min(T_max * 0.99, d_T));
      const dx = xFromRPM(rpm_c), dy = yFromT(T_c);
      ctx.shadowColor = 'rgba(239,83,80,0.7)';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(dx, dy, 5, 0, 2 * Math.PI);
      ctx.fillStyle = '#ef5350';
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }, [mc, pack, lastPoint, hoverPx]);

  return (
    <canvas
      ref={canvasRef}
      height={280}
      style={{ display: 'block', width: '100%', cursor: 'crosshair', background: '#0d0d14', border: '1px solid #1a1a24' }}
    />
  );
}
