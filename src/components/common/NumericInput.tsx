import { useState, useRef, useEffect } from 'react';

interface NumericInputProps {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  style?: React.CSSProperties;
}

export function NumericInput({ value, onChange, min, max, step, style }: NumericInputProps) {
  const [raw, setRaw] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      setRaw(String(value));
    }
  }, [value]);

  const commit = () => {
    const n = parseFloat(raw);
    if (!isNaN(n)) {
      const lo = min ?? -Infinity;
      const hi = max ?? Infinity;
      const clamped = Math.min(hi, Math.max(lo, n));
      onChange(clamped);
      setRaw(String(clamped));
    } else {
      setRaw(String(value));
    }
  };

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      value={raw}
      onChange={e => setRaw(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }}
      style={style}
    />
  );
}
