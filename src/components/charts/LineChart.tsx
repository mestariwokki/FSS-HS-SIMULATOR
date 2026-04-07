import { useEffect, useRef } from 'react';

const PAD = { t: 12, r: 14, b: 28, l: 52 };

interface Series {
  key: string;
  color: string;
  label: string;
  lineWidth?: number;
  dashed?: boolean;
}

interface HLine {
  value: number;
  color: string;
}

interface LineChartProps {
  data: Record<string, number>[];
  series: Series[];
  xKey: string;
  height: number;
  yMin?: number;
  yMax?: number;
  yUnit?: string;
  xUnit?: string;
  hLines?: HLine[];
  hoveredX?: number | null;
  hoveredPoint?: Record<string, number> | null;
}

export function LineChart({
  data, series, xKey, height, yMin: yMinProp, yMax: yMaxProp,
  yUnit = '', xUnit = 's', hLines, hoveredX, hoveredPoint,
}: LineChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const W = canvas.parentElement?.clientWidth || 600;
    canvas.width = W * dpr;
    canvas.height = height * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = height + 'px';
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const cw = W - PAD.l - PAD.r;
    const ch = height - PAD.t - PAD.b;

    // Background
    ctx.fillStyle = '#1c1c22';
    ctx.fillRect(0, 0, W, height);

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const y = PAD.t + i * ch / 4;
      ctx.beginPath();
      ctx.moveTo(PAD.l, y);
      ctx.lineTo(PAD.l + cw, y);
      ctx.stroke();
    }

    if (!data || data.length < 2) {
      ctx.fillStyle = '#333';
      ctx.font = '11px Courier New';
      ctx.textAlign = 'center';
      ctx.fillText('Start simulation', W / 2, height / 2 + 4);
      return;
    }

    const tMax = data[data.length - 1][xKey];
    const allVals = series.flatMap(s => data.map(d => d[s.key] ?? 0));
    const autoMin = Math.min(...allVals);
    const autoMax = Math.max(...allVals);
    const yMin = yMinProp ?? autoMin - Math.abs(autoMax - autoMin) * 0.05;
    const yMax = yMaxProp ?? autoMax + Math.abs(autoMax - autoMin) * 0.05;
    const yRange = yMax - yMin || 1;

    const px = (d: Record<string, number>) => PAD.l + (d[xKey] / tMax) * cw;
    const py = (v: number) => PAD.t + ch * (1 - (v - yMin) / yRange);

    // Horizontal lines
    if (hLines) {
      for (const hl of hLines) {
        const y = py(hl.value);
        if (y < PAD.t || y > PAD.t + ch) continue;
        ctx.save();
        ctx.strokeStyle = hl.color;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(PAD.l, y);
        ctx.lineTo(PAD.l + cw, y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }
    }

    // Data lines
    for (const s of series) {
      ctx.save();
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.lineWidth ?? 1.5;
      if (s.dashed) ctx.setLineDash([3, 2]);
      ctx.beginPath();
      data.forEach((d, i) => {
        const x = px(d);
        const y = py(d[s.key] ?? 0);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.stroke();
      if (s.dashed) ctx.setLineDash([]);
      ctx.restore();
    }

    // Axes
    ctx.fillStyle = '#555';
    ctx.font = '10px Courier New';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
      const v = yMax - yRange * i / 4;
      const precision = yRange < 5 ? 2 : yRange < 50 ? 1 : 0;
      ctx.fillText(v.toFixed(precision) + yUnit, PAD.l - 4, PAD.t + i * ch / 4 + 4);
    }
    ctx.textAlign = 'center';
    for (let i = 0; i <= 4; i++) {
      ctx.fillText((tMax * i / 4).toFixed(0) + xUnit, PAD.l + i * cw / 4, PAD.t + ch + 14);
    }

    // Crosshair
    if (hoveredX != null && hoveredPoint) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(hoveredX, PAD.t);
      ctx.lineTo(hoveredX, PAD.t + ch);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      for (const s of series) {
        const val = hoveredPoint[s.key] ?? 0;
        const dotY = py(val);
        ctx.save();
        ctx.fillStyle = s.color;
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(hoveredX, dotY, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    }
  }, [data, series, xKey, height, yMinProp, yMaxProp, yUnit, xUnit, hLines, hoveredX, hoveredPoint]);

  return (
    <canvas
      ref={canvasRef}
      style={{ display: 'block', width: '100%', cursor: 'crosshair' }}
    />
  );
}
