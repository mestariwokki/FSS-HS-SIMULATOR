import { useEffect, useRef } from 'react';
import { ICE_TORQUE_CURVE, interpICETorque } from '../../simulation/motor/iceEngine';

/** ICE-specific colour map — suited for 15–40 % efficiency range */
function iceEtaColor(eta: number): string {
  eta = Math.max(0, Math.min(1, eta));
  if (eta < 0.15) return 'rgba(30,10,10,0.98)';
  if (eta < 0.25) {
    const t = (eta - 0.15) / 0.10;
    return `rgb(${Math.round(180 + t * 75)},${Math.round(30 + t * 60)},30)`;
  }
  if (eta < 0.35) {
    const t = (eta - 0.25) / 0.10;
    return `rgb(${Math.round(255 - t * 135)},${Math.round(90 + t * 100)},30)`;
  }
  const t = Math.min(1, (eta - 0.35) / 0.10);
  return `rgb(${Math.round(120 - t * 80)},${Math.round(190 + t * 40)},${Math.round(30 + t * 50)})`;
}

interface Props {
  bsfc_gkWh: number;
  opRpm?: number;    // ICE crankshaft RPM
  opTorque?: number; // ICE shaft torque Nm
}

const HHV   = 12.78;  // Wh/g (gasoline)
const RPM_MIN = ICE_TORQUE_CURVE[0][0];
const RPM_MAX = ICE_TORQUE_CURVE[ICE_TORQUE_CURVE.length - 1][0];
const T_MAX_ICE = Math.max(...ICE_TORQUE_CURVE.map(([, T]) => T));

/**
 * Parametric BSFC model — sweet spot at ~70% load, 5500 RPM.
 * bsfc_min is the user-supplied best-island value (e.g. 300 g/kWh).
 */
function bsfcAt(rpm: number, load_frac: number, bsfc_min: number): number {
  const dRpm = rpm / 5500 - 1;
  const dLoad = load_frac - 0.70;
  return bsfc_min * Math.exp(0.35 * dRpm * dRpm + 0.90 * dLoad * dLoad);
}

export function HybridIceMap({ bsfc_gkWh, opRpm, opTorque }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const W = canvas.offsetWidth || 300;
    const H = 180;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const PL = 42, PR = 8, PT = 10, PB = 32;
    const cw = W - PL - PR, ch = H - PT - PB;
    const NX = 80, NY = 50;
    const cellW = cw / NX, cellH = ch / NY;

    const xFromRpm = (r: number) => PL + ((r - RPM_MIN) / (RPM_MAX - RPM_MIN)) * cw;
    const yFromT   = (T: number) => PT + (1 - T / T_MAX_ICE) * ch;

    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, W, H);

    for (let ix = 0; ix < NX; ix++) {
      const rpm = RPM_MIN + (ix + 0.5) / NX * (RPM_MAX - RPM_MIN);
      const T_curve = interpICETorque(rpm);

      for (let iy = 0; iy < NY; iy++) {
        const T_nm = (1 - (iy + 0.5) / NY) * T_MAX_ICE;
        const cx = PL + ix * cellW, cy = PT + iy * cellH;

        if (T_nm > T_curve || T_curve <= 0) {
          ctx.fillStyle = 'rgba(255,255,255,0.03)';
          ctx.fillRect(cx, cy, cellW + 0.5, cellH + 0.5);
          continue;
        }

        const load_frac = T_nm / T_curve;
        const bsfc_pt = bsfcAt(rpm, load_frac, bsfc_gkWh);
        const eta = Math.min(1, 1000 / (bsfc_pt * HHV));
        ctx.fillStyle = iceEtaColor(eta);
        ctx.fillRect(cx, cy, cellW + 0.5, cellH + 0.5);
      }
    }

    // Torque curve overlay (white)
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ICE_TORQUE_CURVE.forEach(([rpm, T]: [number, number], i) => {
      const x = xFromRpm(rpm), y = yFromT(T);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.restore();

    // Axes
    ctx.strokeStyle = '#444'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PL, PT); ctx.lineTo(PL, PT + ch); ctx.lineTo(PL + cw, PT + ch);
    ctx.stroke();

    // X labels (RPM)
    ctx.font = '9px monospace'; ctx.fillStyle = '#777'; ctx.textAlign = 'center';
    for (let r = 2000; r <= RPM_MAX; r += 2000) {
      ctx.fillText((r / 1000).toFixed(0) + 'k', xFromRpm(r), PT + ch + 13);
    }

    // Y labels (Nm)
    ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
      const T_v = T_MAX_ICE * (1 - i / 4);
      ctx.fillText(T_v.toFixed(0), PL - 3, PT + (i / 4) * ch + 3);
    }

    ctx.fillStyle = '#555'; ctx.textAlign = 'center'; ctx.font = '9px monospace';
    ctx.fillText('RPM (crank)', PL + cw / 2, PT + ch + 26);

    ctx.save();
    ctx.translate(10, PT + ch / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Nm', 0, 0);
    ctx.restore();

    // Label + η_opt annotation
    ctx.fillStyle = '#ffa726'; ctx.textAlign = 'left'; ctx.font = 'bold 9px monospace';
    ctx.fillText('ICE', PL + 4, PT + 13);
    const eta_opt = Math.min(0.45, 1000 / (bsfc_gkWh * HHV));
    ctx.fillStyle = '#888'; ctx.font = '9px monospace';
    ctx.fillText(`η_opt=${(eta_opt * 100).toFixed(0)}%`, PL + 30, PT + 13);

    // Legend
    const legend = [
      { color: '#66bb6a', text: 'η ≥ 35%' },
      { color: '#ffca28', text: 'η 25–35%' },
      { color: '#ef5350', text: 'η < 25%' },
      { color: 'rgba(255,255,255,0.12)', text: 'Above curve' },
    ];
    const lx = PL + cw - 68, ly = PT + 6;
    ctx.fillStyle = 'rgba(0,0,0,0.62)';
    ctx.fillRect(lx - 3, ly - 4, 72, legend.length * 13 + 5);
    ctx.font = '8px monospace';
    legend.forEach(({ color, text }, i) => {
      const y = ly + i * 13;
      ctx.fillStyle = color;
      ctx.fillRect(lx, y, 8, 8);
      ctx.fillStyle = '#aaa';
      ctx.textAlign = 'left';
      ctx.fillText(text, lx + 11, y + 7);
    });

    // Operating point
    if (opRpm != null && opTorque != null && opRpm > RPM_MIN) {
      const ox = xFromRpm(opRpm);
      const oy = yFromT(opTorque);
      if (ox >= PL && ox <= PL + cw && oy >= PT && oy <= PT + ch) {
        ctx.beginPath(); ctx.arc(ox, oy, 4.5, 0, 2 * Math.PI);
        ctx.fillStyle = '#ffa726'; ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
      }
    }
  }, [bsfc_gkWh, opRpm, opTorque]);

  return (
    <canvas
      ref={ref}
      height={180}
      style={{ display: 'block', width: '100%', background: '#0d0d14', border: '1px solid #1a1a24' }}
    />
  );
}
