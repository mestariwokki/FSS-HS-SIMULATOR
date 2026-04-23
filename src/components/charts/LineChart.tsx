import { useEffect, useRef, useState, useCallback } from 'react';

const PAD = { t: 12, r: 14, b: 28, l: 52 };
const MAX_DRAW_POINTS = 600; // decimate for display only
const SMOOTH_WINDOW = 5;     // moving-average window for visualisation

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

interface TooltipRow {
  label: string;
  value: string;
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
  smooth?: boolean;
  /** Called with hovered data point (raw, not smoothed) */
  onHover?: (point: Record<string, number> | null) => void;
  /** Extra rows for the tooltip beyond the auto-generated series rows */
  extraTooltipRows?: (point: Record<string, number>) => TooltipRow[];
}

/** Decimate data array to at most maxPts points using min-max envelope */
function decimate(data: Record<string, number>[], keys: string[], xKey: string, maxPts: number) {
  if (data.length <= maxPts) return data;
  const factor = Math.ceil(data.length / maxPts);
  const out: Record<string, number>[] = [];
  for (let i = 0; i < data.length; i += factor) {
    const chunk = data.slice(i, Math.min(i + factor, data.length));
    const rep: Record<string, number> = { [xKey]: chunk[Math.floor(chunk.length / 2)][xKey] };
    for (const k of keys) {
      rep[k] = chunk.reduce((s, d) => s + (d[k] ?? 0), 0) / chunk.length;
    }
    out.push(rep);
  }
  return out;
}

/** Moving average smoothing — only for display */
function smooth(data: Record<string, number>[], keys: string[], window: number) {
  if (data.length < window * 2) return data;
  const half = Math.floor(window / 2);
  return data.map((d, i) => {
    const start = Math.max(0, i - half);
    const end = Math.min(data.length - 1, i + half);
    const chunk = data.slice(start, end + 1);
    const out: Record<string, number> = { ...d };
    for (const k of keys) {
      out[k] = chunk.reduce((s, p) => s + (p[k] ?? 0), 0) / chunk.length;
    }
    return out;
  });
}

export function LineChart({
  data, series, xKey, height,
  yMin: yMinProp, yMax: yMaxProp,
  yUnit = '', xUnit = 's',
  hLines, smooth: doSmooth = false,
  onHover, extraTooltipRows,
}: LineChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredPoint, setHoveredPoint] = useState<Record<string, number> | null>(null);
  const [hoverX, setHoverX] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // Prepare display data (decimated + optionally smoothed)
  const seriesKeys = series.map(s => s.key);
  const displayData = (() => {
    if (!data || data.length < 2) return data;
    let d = decimate(data, seriesKeys, xKey, MAX_DRAW_POINTS);
    if (doSmooth) d = smooth(d, seriesKeys, SMOOTH_WINDOW);
    return d;
  })();

  // ── Draw ──────────────────────────────────────────────────────────────────
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

    ctx.fillStyle = '#0d0d14';
    ctx.fillRect(0, 0, W, height);

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const y = PAD.t + i * ch / 4;
      ctx.beginPath(); ctx.moveTo(PAD.l, y); ctx.lineTo(PAD.l + cw, y); ctx.stroke();
    }

    if (!displayData || displayData.length < 2) {
      ctx.fillStyle = '#3a3a50';
      ctx.font = '11px IBM Plex Mono, Courier New';
      ctx.textAlign = 'center';
      ctx.fillText('Start simulation', W / 2, height / 2 + 4);
      return;
    }

    const tMax = displayData[displayData.length - 1][xKey];
    const allVals = series.flatMap(s => displayData.map(d => d[s.key] ?? 0)).filter(isFinite);
    const autoMin = allVals.length ? Math.min(...allVals) : 0;
    const autoMax = allVals.length ? Math.max(...allVals) : 1;
    const pad = Math.abs(autoMax - autoMin) * 0.08 || 0.5;
    const yMin = yMinProp ?? autoMin - pad;
    const yMax = yMaxProp ?? autoMax + pad;
    const yRange = yMax - yMin || 1;

    const px = (d: Record<string, number>) => PAD.l + (d[xKey] / tMax) * cw;
    const py = (v: number) => PAD.t + ch * (1 - (v - yMin) / yRange);

    // Horizontal reference lines
    if (hLines) {
      for (const hl of hLines) {
        const y = py(hl.value);
        if (y < PAD.t || y > PAD.t + ch) continue;
        ctx.save();
        ctx.strokeStyle = hl.color;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.moveTo(PAD.l, y); ctx.lineTo(PAD.l + cw, y); ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }
    }

    // Series lines
    for (const s of series) {
      ctx.save();
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.lineWidth ?? 1.5;
      if (s.dashed) ctx.setLineDash([3, 2]);
      ctx.beginPath();
      displayData.forEach((d, i) => {
        const x = px(d);
        const y = py(d[s.key] ?? 0);
        if (i === 0) { ctx.moveTo(x, y); } else { ctx.lineTo(x, y); }
      });
      ctx.stroke();
      if (s.dashed) ctx.setLineDash([]);
      ctx.restore();
    }

    // Y-axis labels
    ctx.fillStyle = '#666678';
    ctx.font = '10px IBM Plex Mono, Courier New';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
      const v = yMax - yRange * i / 4;
      const precision = yRange < 5 ? 2 : yRange < 50 ? 1 : 0;
      ctx.fillText(v.toFixed(precision) + yUnit, PAD.l - 4, PAD.t + i * ch / 4 + 4);
    }

    // X-axis labels
    ctx.textAlign = 'center';
    for (let i = 0; i <= 4; i++) {
      ctx.fillText((tMax * i / 4).toFixed(0) + xUnit, PAD.l + i * cw / 4, PAD.t + ch + 14);
    }

    // Crosshair + dots
    if (hoverX != null && hoveredPoint) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 4]);
      ctx.beginPath(); ctx.moveTo(hoverX, PAD.t); ctx.lineTo(hoverX, PAD.t + ch); ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      for (const s of series) {
        const val = hoveredPoint[s.key] ?? 0;
        const dotY = py(val);
        if (dotY < PAD.t - 4 || dotY > PAD.t + ch + 4) continue;
        ctx.save();
        ctx.fillStyle = s.color;
        ctx.strokeStyle = '#0d0d14';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(hoverX, dotY, 4, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        ctx.restore();
      }
    }
  }, [displayData, series, xKey, height, yMinProp, yMaxProp, yUnit, xUnit, hLines, hoverX, hoveredPoint]);

  // ── Mouse handlers ────────────────────────────────────────────────────────
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!data || data.length < 2) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const W = rect.width;
    const cw = W - PAD.l - PAD.r;

    if (mx < PAD.l - 2 || mx > W - PAD.r + 2) {
      setHoveredPoint(null); setHoverX(null); onHover?.(null);
      return;
    }

    const frac = Math.max(0, Math.min(1, (mx - PAD.l) / cw));
    const tMax = data[data.length - 1][xKey];
    const tTarget = frac * tMax;

    // Binary search on raw data for nearest point
    let lo = 0, hi = data.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (data[mid][xKey] < tTarget) lo = mid + 1; else hi = mid;
    }
    const best = (lo > 0 && Math.abs(data[lo - 1][xKey] - tTarget) < Math.abs(data[lo][xKey] - tTarget))
      ? lo - 1 : lo;

    const pt = data[best];
    const dotX = PAD.l + (pt[xKey] / tMax) * cw;
    setHoveredPoint(pt);
    setHoverX(dotX);
    setTooltipPos({ x: e.clientX, y: e.clientY });
    onHover?.(pt);
  }, [data, xKey, onHover]);

  const handleMouseLeave = useCallback(() => {
    setHoveredPoint(null);
    setHoverX(null);
    onHover?.(null);
  }, [onHover]);

  // ── Tooltip content ───────────────────────────────────────────────────────
  const tooltipRows: TooltipRow[] = hoveredPoint ? [
    { label: 't', value: `${hoveredPoint[xKey]?.toFixed(2) ?? '?'} ${xUnit}`, color: '#888' },
    ...series.map(s => ({
      label: s.label,
      value: `${(hoveredPoint[s.key] ?? 0).toFixed(3)} ${yUnit}`,
      color: s.color,
    })),
    ...(extraTooltipRows ? extraTooltipRows(hoveredPoint) : []),
  ] : [];

  return (
    <div style={{ position: 'relative' }}>
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', cursor: 'crosshair' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      />
      {hoveredPoint && tooltipRows.length > 0 && (() => {
        const TW = 180, TH = 90, OFF = 14;
        const tx = tooltipPos.x + TW + OFF > window.innerWidth - 8
          ? tooltipPos.x - TW - OFF
          : tooltipPos.x + OFF;
        const ty = tooltipPos.y - 10 + TH > window.innerHeight - 8
          ? tooltipPos.y - TH - OFF
          : tooltipPos.y - 10;
        return (
        <div style={{
          position: 'fixed',
          left: tx,
          top: ty,
          background: 'rgba(8,8,16,0.97)',
          border: '1px solid #252534',
          borderRadius: '4px',
          padding: '6px 10px',
          fontSize: '11px',
          fontFamily: 'IBM Plex Mono, Courier New, monospace',
          pointerEvents: 'none',
          zIndex: 9999,
          whiteSpace: 'nowrap',
        }}>
          {tooltipRows.map((row, i) => (
            <div key={i} style={{ display: 'flex', gap: '8px', justifyContent: 'space-between', marginBottom: i < tooltipRows.length - 1 ? '2px' : 0 }}>
              <span style={{ color: row.color }}>{row.label}</span>
              <span style={{ color: '#aaaabc' }}>{row.value}</span>
            </div>
          ))}
        </div>
        );
      })()}
    </div>
  );
}
