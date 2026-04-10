import { useEffect, useRef } from 'react';
import { etaColor } from '../../simulation/motor/efficiencyMap';

interface Props {
  label: string;
  labelColor?: string;
  opRpm?: number;    // motor shaft RPM
  opTorque?: number; // motor shaft Nm
}

// Neumotors 6530/104 hub motor (estimated parameters)
const KV    = 104;                            // RPM/V
const KV_R  = KV * 2 * Math.PI / 60;         // rad/s/V
const KT    = 1 / KV_R;                       // Nm/A ≈ 0.0916
const R_W   = 0.082;                          // Ω winding
const I_PK  = 90;                             // A peak
const V_NOM = 48.1;                           // V (13S × 3.7V nom)
const V_MAX = 54.6;                           // V (13S × 4.2V)
const ETA_ESC = 0.97;                         // ESC efficiency

const RPM_MAX = KV * V_NOM;
const T_MAX   = KT * I_PK;

export function HybridBldcMap({ label, labelColor = '#4fc3f7', opRpm, opTorque }: Props) {
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
    const NX = 60, NY = 40;
    const cellW = cw / NX, cellH = ch / NY;

    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, W, H);

    for (let ix = 0; ix < NX; ix++) {
      const rpm = (ix + 0.5) / NX * RPM_MAX;
      const omega = rpm * 2 * Math.PI / 60;
      const V_bemf = omega / KV_R;

      for (let iy = 0; iy < NY; iy++) {
        const T_m = (1 - (iy + 0.5) / NY) * T_MAX;
        const I_m = T_m / KT;
        const cx = PL + ix * cellW, cy = PT + iy * cellH;

        if (I_m > I_PK || V_bemf + I_m * R_W > V_MAX || V_bemf > V_NOM) {
          ctx.fillStyle = 'rgba(255,255,255,0.03)';
          ctx.fillRect(cx, cy, cellW + 0.5, cellH + 0.5);
          continue;
        }

        const P_mech = T_m * omega;
        const P_elec = (V_bemf * I_m + I_m * I_m * R_W) / ETA_ESC;
        const eta = P_elec > 0.5 ? Math.min(1, P_mech / P_elec) : 0;
        ctx.fillStyle = etaColor(eta);
        ctx.fillRect(cx, cy, cellW + 0.5, cellH + 0.5);
      }
    }

    // Axes
    ctx.strokeStyle = '#444'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PL, PT); ctx.lineTo(PL, PT + ch); ctx.lineTo(PL + cw, PT + ch);
    ctx.stroke();

    // X labels (RPM)
    ctx.font = '9px monospace'; ctx.fillStyle = '#777'; ctx.textAlign = 'center';
    for (let r = 0; r <= RPM_MAX; r += 1000) {
      const x = PL + (r / RPM_MAX) * cw;
      ctx.fillText(r === 0 ? '0' : (r / 1000).toFixed(0) + 'k', x, PT + ch + 13);
    }

    // Y labels (Nm)
    ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
      const T_v = T_MAX * (1 - i / 4);
      ctx.fillText(T_v.toFixed(1), PL - 3, PT + (i / 4) * ch + 3);
    }

    ctx.fillStyle = '#555'; ctx.textAlign = 'center'; ctx.font = '9px monospace';
    ctx.fillText('RPM (shaft)', PL + cw / 2, PT + ch + 26);

    ctx.save();
    ctx.translate(10, PT + ch / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Nm', 0, 0);
    ctx.restore();

    // Label
    ctx.fillStyle = labelColor; ctx.textAlign = 'left'; ctx.font = 'bold 9px monospace';
    ctx.fillText(label, PL + 4, PT + 13);

    // Legend
    const legend = [
      { color: '#66bb6a', text: 'η ≥ 85%' },
      { color: '#ffca28', text: 'η 70–85%' },
      { color: '#ef5350', text: 'η < 70%' },
      { color: 'rgba(255,255,255,0.12)', text: 'Raja ylitetty' },
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
    if (opRpm != null && opTorque != null && opRpm > 0) {
      const ox = PL + (opRpm / RPM_MAX) * cw;
      const oy = PT + (1 - opTorque / T_MAX) * ch;
      if (ox >= PL && ox <= PL + cw && oy >= PT && oy <= PT + ch) {
        ctx.beginPath(); ctx.arc(ox, oy, 4.5, 0, 2 * Math.PI);
        ctx.fillStyle = '#fff'; ctx.fill();
        ctx.strokeStyle = labelColor; ctx.lineWidth = 1.5; ctx.stroke();
      }
    }
  }, [label, labelColor, opRpm, opTorque]);

  return (
    <canvas
      ref={ref}
      height={180}
      style={{ display: 'block', width: '100%', background: '#111', border: '1px solid #1e1e1e' }}
    />
  );
}
