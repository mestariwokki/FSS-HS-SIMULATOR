import { ParamGroup } from '../common/ParamGroup';

interface SoHPanelProps {
  cycles: number;
  r1: number;
  tau1: number;
  r2: number;
  tau2: number;
  onCyclesChange: (v: number) => void;
  onR1Change: (v: number) => void;
  onTau1Change: (v: number) => void;
  onR2Change: (v: number) => void;
  onTau2Change: (v: number) => void;
}

export function SoHPanel(props: SoHPanelProps) {
  return (
    <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--border-dim)' }}>
      <div style={{ fontSize: '9px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '6px' }}>
        Aging (SoH) -- 2RC ECM
      </div>
      <ParamGroup label="Cycles N" value={props.cycles} onChange={props.onCyclesChange} min={0} max={3000} step={10} unit="cycles" />
      <ParamGroup label="R1" value={props.r1} onChange={props.onR1Change} min={1} max={200} step={1} unit="mOhm" title="Thevenin 2RC: fast polarization resistance per cell" />
      <ParamGroup label="tau1" value={props.tau1} onChange={props.onTau1Change} min={1} max={300} step={1} unit="s" />
      <ParamGroup label="R2" value={props.r2} onChange={props.onR2Change} min={1} max={200} step={1} unit="mOhm" />
      <ParamGroup label="tau2" value={props.tau2} onChange={props.onTau2Change} min={1} max={600} step={1} unit="s" />
    </div>
  );
}
