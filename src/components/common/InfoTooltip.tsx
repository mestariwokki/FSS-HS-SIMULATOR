import { useState, useRef, useCallback, useEffect } from 'react';
import T from '../../data/tooltips';

interface InfoTooltipProps {
  /** Key from tooltips.ts, or inline TooltipDef fields */
  term?: string;
  /** Override label shown to user (defaults to term key) */
  label?: string;
  delay?: number;
  children?: React.ReactNode;
}

interface Pos { x: number; y: number }

export function InfoTooltip({ term, label, delay = 1000, children }: InfoTooltipProps) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState<Pos>({ x: 0, y: 0 });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLSpanElement>(null);

  const def = term ? T[term] : null;
  const displayLabel = label ?? (def ? def.abbr : (term ?? ''));

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleEnter = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    clearTimer();
    let cx: number, cy: number;
    if ('touches' in e) {
      cx = e.touches[0].clientX;
      cy = e.touches[0].clientY;
    } else {
      cx = (e as React.MouseEvent).clientX;
      cy = (e as React.MouseEvent).clientY;
    }
    timerRef.current = setTimeout(() => {
      setPos({ x: cx, y: cy });
      setVisible(true);
    }, delay);
  }, [clearTimer, delay]);

  const handleLeave = useCallback(() => {
    clearTimer();
    setVisible(false);
  }, [clearTimer]);

  // Click outside dismissal
  useEffect(() => {
    if (!visible) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setVisible(false);
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [visible]);

  // Compute clamped tooltip position
  const vpW = typeof window !== 'undefined' ? window.innerWidth : 800;
  const vpH = typeof window !== 'undefined' ? window.innerHeight : 600;
  const TW = 320;
  const TH = 180; // approximate
  let tipX = pos.x + 12;
  let tipY = pos.y + 12;
  if (tipX + TW > vpW - 8) tipX = pos.x - TW - 6;
  if (tipY + TH > vpH - 8) tipY = pos.y - TH - 6;

  return (
    <span
      ref={containerRef}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onTouchStart={handleEnter}
      onTouchEnd={handleLeave}
      style={{ position: 'relative', cursor: 'help', display: 'inline' }}
    >
      <span style={{
        color: 'var(--text-secondary)',
        borderBottom: def ? '1px dashed var(--accent-em)' : undefined,
        textDecoration: 'none',
      }}>
        {children ?? displayLabel}
      </span>

      {visible && def && (
        <div style={{
          position: 'fixed',
          left: tipX,
          top: tipY,
          zIndex: 10000,
          background: 'var(--bg-panel)',
          border: '1px solid var(--accent-em)',
          padding: '12px 14px',
          width: 'max-content',
          minWidth: '200px',
          maxWidth: `${TW}px`,
          boxSizing: 'border-box',
          whiteSpace: 'normal',
          wordBreak: 'break-word',
          boxShadow: '0 4px 24px rgba(0,0,0,0.8)',
          pointerEvents: 'none',
          fontFamily: "'IBM Plex Mono', 'Courier New', monospace",
        }}>
          {/* Arrow */}
          <div style={{
            position: 'absolute',
            top: -7,
            left: 14,
            width: 0,
            height: 0,
            borderLeft: '6px solid transparent',
            borderRight: '6px solid transparent',
            borderBottom: '7px solid var(--accent-em)',
          }} />
          {/* Header */}
          <div style={{ marginBottom: '6px' }}>
            <span style={{ color: 'var(--accent-em)', fontSize: '13px', fontWeight: 'bold' }}>{def.abbr}</span>
            <span style={{ color: 'var(--text-dim)', fontSize: '11px', marginLeft: '6px' }}>{def.unit && `[${def.unit}]`}</span>
          </div>
          <div style={{ color: 'var(--text-primary)', fontSize: '11px', fontStyle: 'italic', marginBottom: '6px', lineHeight: 1.4 }}>
            {def.name}
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '11px', lineHeight: 1.5, marginBottom: def.formula ? '6px' : 0 }}>
            {def.description}
          </div>
          {def.formula && (
            <div style={{
              background: 'var(--bg-root)',
              border: '1px solid var(--border-main)',
              padding: '4px 8px',
              fontSize: '11px',
              color: 'var(--accent-vehicle)',
              overflowWrap: 'break-word',
              marginBottom: def.range ? '5px' : 0,
            }}>
              {def.formula}
            </div>
          )}
          {def.range && (
            <div style={{ color: 'var(--text-dim)', fontSize: '10px', marginTop: '4px' }}>
              Typical: {def.range}
            </div>
          )}
        </div>
      )}
    </span>
  );
}
