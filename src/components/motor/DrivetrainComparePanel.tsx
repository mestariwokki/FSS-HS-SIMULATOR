import { ParamGroup } from '../common/ParamGroup';
import { InfoTooltip } from '../common/InfoTooltip';
import { kVtoKt } from '../../simulation/motor/motorConstants';
import { ICE_TORQUE_CURVE, interpICETorque } from '../../simulation/motor/iceEngine';

// ── Section header helper ─────────────────────────────────────────────────
function SectionHead({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: '10px',
      color: '#4fc3f7',
      textTransform: 'uppercase',
      letterSpacing: '2px',
      borderBottom: '1px solid #1e3a4a',
      paddingBottom: '4px',
      marginTop: '14px',
      marginBottom: '8px',
    }}>
      {children}
    </div>
  );
}

// ── Column header helper ──────────────────────────────────────────────────
function ColumnHead({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <div style={{
      fontSize: '12px',
      color: color,
      fontWeight: 'bold',
      textTransform: 'uppercase',
      letterSpacing: '2px',
      borderBottom: `2px solid ${color}`,
      paddingBottom: '6px',
      marginBottom: '12px',
    }}>
      {children}
    </div>
  );
}

// ── Derived-value row ─────────────────────────────────────────────────────
function DerivedRow({ label, value, unit, color = '#ddd', term }: {
  label: string; value: string; unit: string; color?: string; term?: string;
}) {
  return (
    <div style={{ display: 'flex', gap: '6px', alignItems: 'baseline', marginBottom: '5px', fontSize: '12px' }}>
      <span style={{ color: '#888', minWidth: '120px', whiteSpace: 'nowrap' }}>
        {term ? <InfoTooltip term={term} label={label} /> : label}
      </span>
      <span style={{ color, fontWeight: 'bold' }}>{value}</span>
      <span style={{ color: '#666', fontSize: '11px' }}>{unit}</span>
    </div>
  );
}

// ── Hybrid summary stat ───────────────────────────────────────────────────
function StatCard({ label, value, unit, color = '#ddd' }: {
  label: string; value: string; unit: string; color?: string;
}) {
  return (
    <div style={{
      background: '#1a1a22',
      border: '1px solid #2a2a3a',
      borderRadius: '3px',
      padding: '10px 14px',
      textAlign: 'center',
      minWidth: '110px',
    }}>
      <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>
        {label}
      </div>
      <div style={{ fontSize: '20px', fontWeight: 'bold', color }}>
        {value}
        <span style={{ fontSize: '11px', color: '#666', marginLeft: '3px' }}>{unit}</span>
      </div>
    </div>
  );
}

// ── BLDC column ───────────────────────────────────────────────────────────
interface BldcProps {
  kV: number; setKV: (v: number) => void;
  Rw: number; setRw: (v: number) => void;
  gear: number; setGear: (v: number) => void;
  wheelD: number; setWheelD: (v: number) => void;
  pCont: number; setPCont: (v: number) => void;
  pPeak: number; setPPeak: (v: number) => void;
  iCont: number; setICont: (v: number) => void;
  iPeak: number; setIPeak: (v: number) => void;
  nMotors: number; setNMotors: (v: number) => void;
  etaEsc: number; setEtaEsc: (v: number) => void;
  etaRegen: number; setEtaRegen: (v: number) => void;
  etaMotor: number; setEtaMotor: (v: number) => void;
  mCpMotor: number; setMCpMotor: (v: number) => void;
  rThMotor: number; setRThMotor: (v: number) => void;
  mCpEsc: number; setMCpEsc: (v: number) => void;
  rThEsc: number; setRThEsc: (v: number) => void;
  tAmb: number; setTAmb: (v: number) => void;
}

function BldcColumn(p: BldcProps) {
  const Kt = kVtoKt(p.kV);
  return (
    <div>
      <ColumnHead color="#4fc3f7">Sähkömoottori (BLDC)</ColumnHead>

      <SectionHead>Perusparametrit</SectionHead>
      <ParamGroup label="kV" value={p.kV} onChange={p.setKV} min={10} max={2000} step={1} unit="RPM/V" infoTerm="kV" />
      <ParamGroup label="R_winding" value={p.Rw} onChange={p.setRw} min={0.001} max={2} step={0.01} unit="Ω" />
      <ParamGroup label="Gear ratio" value={p.gear} onChange={p.setGear} min={1} max={20} step={0.1} unit=":1" infoTerm="gear_ratio" />
      <ParamGroup label="Wheel dia" value={p.wheelD} onChange={p.setWheelD} min={200} max={700} step={10} unit="mm" />
      <ParamGroup label="n_motors" value={p.nMotors} onChange={p.setNMotors} min={1} max={4} step={1} unit="" />

      <SectionHead>Teho & virta</SectionHead>
      <ParamGroup label="P_cont" value={p.pCont} onChange={p.setPCont} min={0.5} max={50} step={0.5} unit="kW" infoTerm="P_cont" />
      <ParamGroup label="P_peak" value={p.pPeak} onChange={p.setPPeak} min={0.5} max={50} step={0.5} unit="kW" infoTerm="P_peak" />
      <ParamGroup label="I_cont" value={p.iCont} onChange={p.setICont} min={10} max={500} step={1} unit="A" infoTerm="I_cont" />
      <ParamGroup label="I_peak" value={p.iPeak} onChange={p.setIPeak} min={10} max={500} step={1} unit="A" infoTerm="I_peak" />

      <SectionHead>Hyötysuhde</SectionHead>
      <ParamGroup label="η_ESC" value={p.etaEsc} onChange={p.setEtaEsc} min={0.8} max={1.0} step={0.01} unit="" infoTerm="eta_ESC" />
      <ParamGroup label="η_regen" value={p.etaRegen} onChange={p.setEtaRegen} min={0.5} max={1.0} step={0.01} unit="" infoTerm="eta_regen" />
      <ParamGroup label="η_motor" value={p.etaMotor} onChange={p.setEtaMotor} min={0.7} max={1.0} step={0.01} unit="" infoTerm="eta_motor" />

      <SectionHead>Lämpömalli</SectionHead>
      <ParamGroup label="mCp motor" value={p.mCpMotor} onChange={p.setMCpMotor} min={50} max={5000} step={50} unit="J/K" />
      <ParamGroup label="R_th motor" value={p.rThMotor} onChange={p.setRThMotor} min={0.1} max={5} step={0.1} unit="K/W" />
      <ParamGroup label="mCp ESC" value={p.mCpEsc} onChange={p.setMCpEsc} min={50} max={2000} step={50} unit="J/K" />
      <ParamGroup label="R_th ESC" value={p.rThEsc} onChange={p.setRThEsc} min={0.1} max={5} step={0.1} unit="K/W" />
      <ParamGroup label="T_ambient" value={p.tAmb} onChange={p.setTAmb} min={-10} max={50} step={1} unit="°C" />

      <SectionHead>Lasketut arvot</SectionHead>
      <DerivedRow label="Kt" value={Kt.toFixed(4)} unit="Nm/A" color="#4fc3f7" term="Kt" />
      <DerivedRow label="T_motor @ I_peak" value={(Kt * p.iPeak).toFixed(2)} unit="Nm" color="#66bb6a" />
      <DerivedRow label="P_total peak" value={(p.pPeak * p.nMotors).toFixed(1)} unit="kW" color="#ffa726" />
      <DerivedRow label="P_total cont" value={(p.pCont * p.nMotors).toFixed(1)} unit="kW" color="#ffca28" />
    </div>
  );
}

// ── ICE column ────────────────────────────────────────────────────────────
interface IceProps {
  iceRpm: number; setIceRpm: (v: number) => void;
  iceBsfc: number; setIceBsfc: (v: number) => void;
  iceGear: number; setIceGear: (v: number) => void;
}

function IceColumn(p: IceProps) {
  const torque = interpICETorque(p.iceRpm);
  const power_kW = torque * p.iceRpm * 2 * Math.PI / 60 / 1000;
  const fuelRate_gs = (power_kW * p.iceBsfc) / 3600;
  const peakTorque = Math.max(...ICE_TORQUE_CURVE.map(c => c[1]));
  const peakPower = Math.max(...ICE_TORQUE_CURVE.map(([rpm, T]) => T * rpm * 2 * Math.PI / 60 / 1000));

  return (
    <div>
      <ColumnHead color="#ffa726">ICE — Yamaha MT-07 690cc</ColumnHead>

      <SectionHead>Toimintapiste</SectionHead>
      <ParamGroup label="RPM" value={p.iceRpm} onChange={p.setIceRpm} min={500} max={11000} step={250} unit="" infoTerm="rpm" />
      <ParamGroup label="BSFC" value={p.iceBsfc} onChange={p.setIceBsfc} min={200} max={600} step={10} unit="g/kWh" infoTerm="bsfc" />
      <ParamGroup label="Gear ratio" value={p.iceGear} onChange={p.setIceGear} min={1} max={10} step={0.1} unit=":1" infoTerm="gear_ratio" />

      <SectionHead>Moottorin tiedot (vakio)</SectionHead>
      <DerivedRow label="Iskutilavuus" value="689" unit="cc" color="#888" />
      <DerivedRow label="Sylinterit" value="2" unit="kpl (rinnakkain)" color="#888" />
      <DerivedRow label="Kierrosluku max" value={`${ICE_TORQUE_CURVE[ICE_TORQUE_CURVE.length - 1][0]}`} unit="RPM" color="#888" />
      <DerivedRow label="Max vääntö" value={peakTorque.toFixed(1)} unit="Nm (n. 6 000 RPM)" color="#ffa726" />
      <DerivedRow label="Max teho" value={peakPower.toFixed(1)} unit="kW" color="#66bb6a" />

      <SectionHead>Toimintapisteessä @ {p.iceRpm} RPM</SectionHead>
      <DerivedRow label="Vääntömomentti" value={torque.toFixed(1)} unit="Nm" color="#ffa726" term="ice_torque" />
      <DerivedRow label="Teho" value={power_kW.toFixed(2)} unit="kW" color="#66bb6a" />
      <DerivedRow label="Teho" value={(power_kW * 1.341).toFixed(1)} unit="hp" color="#66bb6a" />
      <DerivedRow label="Pyörävääntö" value={(torque * p.iceGear * 0.97).toFixed(1)} unit="Nm" color="#4fc3f7" />
      <DerivedRow label="Polttoainevirta" value={fuelRate_gs.toFixed(3)} unit="g/s" color="#ef5350" term="bsfc" />
      <DerivedRow label="Kulutus (10 s)" value={(fuelRate_gs * 10).toFixed(1)} unit="g" color="#ef5350" />
      <DerivedRow label="Kulutus (h)" value={(fuelRate_gs * 3600 / 1000).toFixed(2)} unit="kg/h" color="#ef5350" />
    </div>
  );
}

// ── Hybrid summary ────────────────────────────────────────────────────────
interface HybridSummaryProps {
  pPeak: number; pCont: number; nMotors: number;
  iceRpm: number; iceGear: number;
  mass: number;
}

function HybridSummary(p: HybridSummaryProps) {
  const iceTorque = interpICETorque(p.iceRpm);
  const icePower_kW = iceTorque * p.iceRpm * 2 * Math.PI / 60 / 1000;
  const totalPeak_kW = p.pPeak * p.nMotors + icePower_kW;
  const totalCont_kW = p.pCont * p.nMotors + icePower_kW;
  const pwRatio_kgkW = p.mass > 0 ? (p.mass / totalPeak_kW).toFixed(1) : '—';

  return (
    <div style={{
      marginTop: '20px',
      padding: '16px',
      background: '#14141e',
      border: '1px solid #2a2a3a',
      borderRadius: '4px',
    }}>
      <div style={{
        fontSize: '11px', color: '#fff', textTransform: 'uppercase',
        letterSpacing: '2px', marginBottom: '14px',
        borderBottom: '1px solid #2a2a3a', paddingBottom: '6px',
      }}>
        Hybridiyhdistelmä — yhteenveto
      </div>
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <StatCard label="Kokonaisteho (peak)" value={totalPeak_kW.toFixed(1)} unit="kW" color="#ffa726" />
        <StatCard label="Kokonaisteho (cont)" value={totalCont_kW.toFixed(1)} unit="kW" color="#ffca28" />
        <StatCard label="ICE-osuus" value={totalPeak_kW > 0 ? ((icePower_kW / totalPeak_kW) * 100).toFixed(0) : '0'} unit="%" color="#ffa726" />
        <StatCard label="Sähköosuus" value={totalPeak_kW > 0 ? ((p.pPeak * p.nMotors / totalPeak_kW) * 100).toFixed(0) : '0'} unit="%" color="#4fc3f7" />
        <StatCard label="Paino/teho" value={pwRatio_kgkW} unit="kg/kW" color="#66bb6a" />
        <StatCard label="Teho/paino" value={p.mass > 0 ? (totalPeak_kW / p.mass * 1000).toFixed(0) : '—'} unit="W/kg" color="#66bb6a" />
      </div>
    </div>
  );
}

// ── Exported panel ────────────────────────────────────────────────────────
export interface DrivetrainComparePanelProps extends BldcProps, IceProps {
  mass: number;
}

export function DrivetrainComparePanel(props: DrivetrainComparePanelProps) {
  const bldcProps: BldcProps = {
    kV: props.kV, setKV: props.setKV,
    Rw: props.Rw, setRw: props.setRw,
    gear: props.gear, setGear: props.setGear,
    wheelD: props.wheelD, setWheelD: props.setWheelD,
    pCont: props.pCont, setPCont: props.setPCont,
    pPeak: props.pPeak, setPPeak: props.setPPeak,
    iCont: props.iCont, setICont: props.setICont,
    iPeak: props.iPeak, setIPeak: props.setIPeak,
    nMotors: props.nMotors, setNMotors: props.setNMotors,
    etaEsc: props.etaEsc, setEtaEsc: props.setEtaEsc,
    etaRegen: props.etaRegen, setEtaRegen: props.setEtaRegen,
    etaMotor: props.etaMotor, setEtaMotor: props.setEtaMotor,
    mCpMotor: props.mCpMotor, setMCpMotor: props.setMCpMotor,
    rThMotor: props.rThMotor, setRThMotor: props.setRThMotor,
    mCpEsc: props.mCpEsc, setMCpEsc: props.setMCpEsc,
    rThEsc: props.rThEsc, setRThEsc: props.setRThEsc,
    tAmb: props.tAmb, setTAmb: props.setTAmb,
  };

  const iceProps: IceProps = {
    iceRpm: props.iceRpm, setIceRpm: props.setIceRpm,
    iceBsfc: props.iceBsfc, setIceBsfc: props.setIceBsfc,
    iceGear: props.iceGear, setIceGear: props.setIceGear,
  };

  return (
    <div>
      {/* Two-column grid, stacks on narrow viewports */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '32px',
      }}>
        <BldcColumn {...bldcProps} />
        <IceColumn {...iceProps} />
      </div>

      <HybridSummary
        pPeak={props.pPeak}
        pCont={props.pCont}
        nMotors={props.nMotors}
        iceRpm={props.iceRpm}
        iceGear={props.iceGear}
        mass={props.mass}
      />
    </div>
  );
}
