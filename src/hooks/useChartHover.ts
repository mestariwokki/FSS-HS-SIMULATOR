import { useCallback, useRef, useState } from 'react';

const PAD = { t: 12, r: 14, b: 28, l: 52 };

export function useChartHover<T extends { t: number }>(data: T[]) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredPoint, setHoveredPoint] = useState<T | null>(null);
  const [hoverX, setHoverX] = useState<number | null>(null);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!data || data.length < 2) {
      setHoveredPoint(null);
      setHoverX(null);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const W = rect.width;

    if (mx < PAD.l - 2 || mx > W - PAD.r + 2) {
      setHoveredPoint(null);
      setHoverX(null);
      return;
    }

    const frac = Math.max(0, Math.min(1, (mx - PAD.l) / (W - PAD.l - PAD.r)));
    const tMax = data[data.length - 1].t;
    const tTarget = Math.max(0, Math.min(tMax, frac * tMax));

    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < data.length; i++) {
      const dist = Math.abs(data[i].t - tTarget);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    }

    setHoveredPoint(data[best]);
    setHoverX(PAD.l + (data[best].t / tMax) * (W - PAD.l - PAD.r));
  }, [data]);

  const onMouseLeave = useCallback(() => {
    setHoveredPoint(null);
    setHoverX(null);
  }, []);

  return {
    canvasRef,
    hoveredPoint,
    hoverX,
    onMouseMove,
    onMouseLeave,
  };
}
