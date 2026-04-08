import { useState, useCallback, useMemo } from 'react';
import type { PackConfig, EcmConfig, MotorMode, MotorProfileStep, MotorConfig } from '../../types';
import { useMotorSim } from '../../hooks/useMotorSim';
import { DEFAULT_MOTOR } from '../../simulation/motor/motorConstants';
import { kVtoKt } from '../../simulation/motor/motorConstants';
import { calcSoH } from '../../simulation/ecm';
import { Acc75Panel } from './Acc75Panel';
import { MotorLiveValues } from './MotorLiveValues';
import { MotorSummaryTable } from './MotorSummaryTable';
import { Acc75ResultBox } from './Acc75ResultBox';
import { LineChart } from '../charts/LineChart';
import { EfficiencyMap } from '../charts/EfficiencyMap';
import { ParamGroup } from '../common/ParamGroup';
import { exportMotorCSV } from '../../utils/csvExport';
import { DrivetrainComparePanel } from './DrivetrainComparePanel';

export function MotorTab() {
  const sim = useMotorSim();

  // ── Pack config ──────────────────────────────────────────────────────────
  const [series, setSeries] = useState(13);
  const [parallel, setParallel] = useState(2);
  const [capacity, setCapacity] = useState(6.6);
  const [vMax, setVMax] = useState(4.45);
  const [vNom, setVNom] = useState(3.90);
  const [vMin, setVMin] = useState(2.75);
  const [resistance, setResistance] = useState(24);
  const [cycles, setCycles] = useState(0);
  const [r1] = useState(10);
  const [tau1] = useState(5);
  const [r2] = useState(15);
  const [tau2] = useState(50);

  // ── BLDC motor params ────────────────────────────────────────────────────
  const [kV, setKV] = useState(DEFAULT_MOTOR.kV);
  const [Rw, setRw] = useState(DEFAULT_MOTOR.Rw);
  const [gear, setGear] = useState(DEFAULT_MOTOR.gear);
  const [wheelD, setWheelD] = useState(DEFAULT_MOTOR.wheel_d_mm);
  const [pCont, setPCont] = useState(DEFAULT_MOTOR.P_cont);
  const [pPeak, setPPeak] = useState(DEFAULT_MOTOR.P_peak);
  const [iCont, setICont] = useState(DEFAULT_MOTOR.I_cont);
  const [iPeak, setIPeak] = useState(DEFAULT_MOTOR.I_peak);
  const [nMotors, setNMotors] = useState(DEFAULT_MOTOR.n);
  const [etaEsc, setEtaEsc] = useState(DEFAULT_MOTOR.eta_c);
  const [etaRegen, setEtaRegen] = useState(DEFAULT_MOTOR.eta_regen);
  const [etaMotor, setEtaMotor] = useState(DEFAULT_MOTOR.eta_m);
  const [mCpMotor, setMCpMotor] = useState(DEFAULT_MOTOR.mCp_m);
  const [rThMotor, setRThMotor] = useState(DEFAULT_MOTOR.R_th_m);
  const [mCpEsc, setMCpEsc] = useState(DEFAULT_MOTOR.mCp_e);
  const [rThEsc, setRThEsc] = useState(DEFAULT_MOTOR.R_th_e);
  const [tAmb, setTAmb] = useState(DEFAULT_MOTOR.T_amb);

  // ── ICE params ───────────────────────────────────────────────────────────
  const [iceRpm, setIceRpm] = useState(6000);
  const [iceBsfc, setIceBsfc] = useState(300);
  const [iceGear, setIceGear] = useState(3.5);

  // ── Vehicle / accel ──────────────────────────────────────────────────────
  const [mass, setMass] = useState(DEFAULT_MOTOR.mass);
  const [CdA, setCdA] = useState(DEFAULT_MOTOR.CdA);
  const [Crr, setCrr] = useState(DEFAULT_MOTOR.Crr);
  const [mu, setMu] = useState(DEFAULT_MOTOR.mu);
  const [fFront, setFFront] = useState(DEFAULT_MOTOR.f_front);
  const [hCg, setHCg] = useState(DEFAULT_MOTOR.h_cg);
  const [wheelbase, setWheelbase] = useState(DEFAULT_MOTOR.wheelbase);
  const [massAcc, setMassAcc] = useState(DEFAULT_MOTOR.mass_acc);
  const [CrrAcc, setCrrAcc] = useState(DEFAULT_MOTOR.Crr_acc);

  // ── Simulation mode ──────────────────────────────────────────────────────
  const [mode, setMode] = useState<MotorMode>('acc75');
  const [constSpeed, setConstSpeed] = useState(60);
  const [vTarget, setVTarget] = useState(100);
  const [duration, setDuration] = useState(30);
  const [soc0, setSoc0] = useState(100);
  const [t0, setT0] = useState(25);
  const [regenPower, setRegenPower] = useState(3.0);
  const [regenSpeed, setRegenSpeed] = useState(50);
  const [profileSteps, setProfileSteps] = useState<MotorProfileStep[]>([
    { duration_s: 10, speed_kmh: 60, power_kW: 5 },
    { duration_s: 10, speed_kmh: 80, power_kW: 8 },
    { duration_s: 5, speed_kmh: 40, power_kW: -2 },
  ]);

  // ── Derived configs ──────────────────────────────────────────────────────
  const pack: PackConfig = useMemo(() => ({
    series, parallel,
    cell: { capacity_Ah: capacity, v_max: vMax, v_nom: vNom, v_min: vMin },
    resistance_Ohm: resistance / 1000,
    thermalMass_JK: 2700,
    coolingUA_WK: 10,
    v_max: vMax * series,
    v_nom: vNom * series,
    v_min: vMin * series,
    capacity_Ah: capacity * parallel,
    i_max: 198,
  }), [series, parallel, capacity, vMax, vNom, vMin, resistance]);

  const soh = calcSoH(cycles, 1.5e-4, 4.0e-4);
  const ecm: EcmConfig = useMemo(() => ({
    R1_Ohm: r1 / 1000, tau1_s: tau1,
    R2_Ohm: r2 / 1000, tau2_s: tau2,
    cycles, kQ: 1.5e-4, kR: 4.0e-4,
    soh_cap: soh.soh_cap, soh_res: soh.soh_res,
  }), [r1, tau1, r2, tau2, cycles, soh]);

  const Kt = kVtoKt(kV);

  const motorConfig: MotorConfig = useMemo(() => ({
    Kt_NmA: Kt,
    kV_rpmV: kV,
    R_winding_Ohm: Rw,
    P_cont_kW: pCont,
    P_peak_kW: pPeak,
    n_motors: nMotors,
    gear_ratio: gear,
    wheel_diameter_m: wheelD / 1000,
    eta_esc: etaEsc,
    I_cont_A: iCont,
    I_peak_A: iPeak,
    eta_regen: etaRegen,
    eta_motor: etaMotor,
    mCp_motor_JK: mCpMotor,
    Rth_motor_KW: rThMotor,
    mCp_esc_JK: mCpEsc,
    Rth_esc_KW: rThEsc,
  }), [Kt, kV, Rw, pCont, pPeak, nMotors, gear, wheelD, etaEsc, iCont, iPeak, etaRegen, etaMotor, mCpMotor, rThMotor, mCpEsc, rThEsc]);

  const handleStart = useCallback(() => {
    sim.start(
      pack, ecm,
      {
        Kt, kV, Rw,
        eta_c: etaEsc, eta_regen: etaRegen,
        gear, wheel_d_mm: wheelD,
        P_cont: pCont, P_peak: pPeak,
        I_cont: iCont, I_peak: iPeak,
        n: nMotors, eta_m: etaMotor,
        mCp_m: mCpMotor, R_th_m: rThMotor,
        mCp_e: mCpEsc, R_th_e: rThEsc,
        T_amb: tAmb,
        v_start: constSpeed, v_target: vTarget,
        mass, CdA, Crr, mu,
        f_front: fFront, h_cg: hCg, wheelbase,
        mass_acc: massAcc, Crr_acc: CrrAcc,
        soc_warn: 20, I_warn: 200,
      },
      mode, soc0, t0, duration,
      mode === 'profile' ? profileSteps : undefined,
      mode === 'regen' ? { power_kW: regenPower, speed_kmh: regenSpeed } : undefined,
    );
  }, [pack, ecm, Kt, kV, Rw, etaEsc, etaRegen, gear, wheelD, pCont, pPeak, iCont, iPeak, nMotors, etaMotor, mCpMotor, rThMotor, mCpEsc, rThEsc, tAmb, constSpeed, vTarget, mass, CdA, Crr, mu, fFront, hCg, wheelbase, massAcc, CrrAcc, mode, soc0, t0, duration, profileSteps, regenPower, regenSpeed, sim]);

  const lastPoint = sim.data.length > 0 ? sim.data[sim.data.length - 1] : null;

  const addProfileStep = () => {
    setProfileSteps(prev => [...prev, { duration_s: 10, speed_kmh: 60, power_kW: 5 }]);
  };
  const removeProfileStep = (idx: number) => {
    setProfileSteps(prev => prev.filter((_, i) => i !== idx));
  };
  const updateProfileStep = (idx: number, field: keyof MotorProfileStep, val: number) => {
    setProfileSteps(prev => prev.map((step, i) =>
      i === idx ? { ...step, [field]: val } : step
    ));
  };

  return (
    <div>

      {/* ── Drivetrain parameters ─────────────────────────────────────────── */}
      <div style={{
        background: '#131318',
        border: '1px solid #1e1e2e',
        borderRadius: '4px',
        padding: '20px',
        marginBottom: '20px',
      }}>
        <div style={{
          fontSize: '11px', color: '#fff', textTransform: 'uppercase',
          letterSpacing: '2px', borderBottom: '1px solid #2a2a3a',
          paddingBottom: '6px', marginBottom: '20px',
        }}>
          Drivetrain Parameters
        </div>
        <DrivetrainComparePanel
          kV={kV} setKV={setKV}
          Rw={Rw} setRw={setRw}
          gear={gear} setGear={setGear}
          wheelD={wheelD} setWheelD={setWheelD}
          pCont={pCont} setPCont={setPCont}
          pPeak={pPeak} setPPeak={setPPeak}
          iCont={iCont} setICont={setICont}
          iPeak={iPeak} setIPeak={setIPeak}
          nMotors={nMotors} setNMotors={setNMotors}
          etaEsc={etaEsc} setEtaEsc={setEtaEsc}
          etaRegen={etaRegen} setEtaRegen={setEtaRegen}
          etaMotor={etaMotor} setEtaMotor={setEtaMotor}
          mCpMotor={mCpMotor} setMCpMotor={setMCpMotor}
          rThMotor={rThMotor} setRThMotor={setRThMotor}
          mCpEsc={mCpEsc} setMCpEsc={setMCpEsc}
          rThEsc={rThEsc} setRThEsc={setRThEsc}
          tAmb={tAmb} setTAmb={setTAmb}
          iceRpm={iceRpm} setIceRpm={setIceRpm}
          iceBsfc={iceBsfc} setIceBsfc={setIceBsfc}
          iceGear={iceGear} setIceGear={setIceGear}
          mass={mass}
        />
      </div>

      {/* ── Battery pack + Vehicle ────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '24px', marginBottom: '20px' }}>
        <div>
          <div style={{ fontSize: '11px', color: '#fff', textTransform: 'uppercase', letterSpacing: '2px', borderBottom: '1px solid #333', paddingBottom: '5px', marginBottom: '10px' }}>
            Battery Pack
          </div>
          <ParamGroup label="Series" value={series} onChange={setSeries} min={1} max={30} step={1} unit="s" />
          <ParamGroup label="Parallel" value={parallel} onChange={setParallel} min={1} max={10} step={1} unit="p" />
          <ParamGroup label="Capacity" value={capacity} onChange={setCapacity} min={0.5} max={20} step={0.1} unit="Ah" />
          <ParamGroup label="V_max" value={vMax} onChange={setVMax} min={3.0} max={5.0} step={0.01} unit="V" infoTerm="V_batt" />
          <ParamGroup label="V_nom" value={vNom} onChange={setVNom} min={2.5} max={4.5} step={0.01} unit="V" />
          <ParamGroup label="V_min" value={vMin} onChange={setVMin} min={2.0} max={3.5} step={0.01} unit="V" />
          <ParamGroup label="R_cell" value={resistance} onChange={setResistance} min={1} max={200} step={1} unit="mΩ" />
          <ParamGroup label="Cycles" value={cycles} onChange={setCycles} min={0} max={5000} step={50} unit="" infoTerm="SoH_cap" />
        </div>
        <div>
          <div style={{ fontSize: '11px', color: '#fff', textTransform: 'uppercase', letterSpacing: '2px', borderBottom: '1px solid #333', paddingBottom: '5px', marginBottom: '10px' }}>
            Vehicle
          </div>
          <ParamGroup label="Mass" value={mass} onChange={setMass} min={100} max={600} step={5} unit="kg" />
          <ParamGroup label="CdA" value={CdA} onChange={setCdA} min={0.1} max={2.0} step={0.01} unit="m²" infoTerm="CdA" />
          <ParamGroup label="Crr" value={Crr} onChange={setCrr} min={0.005} max={0.05} step={0.001} unit="" infoTerm="Crr" />
          <div style={{ marginTop: '10px', fontSize: '12px', color: '#ccc', lineHeight: 1.9 }}>
            V_bat nom = <span style={{ color: '#ffca28' }}>{(vNom * series).toFixed(1)}</span> V<br />
            V_bat max = <span style={{ color: '#ffca28' }}>{(vMax * series).toFixed(1)}</span> V<br />
            Capacity = <span style={{ color: '#4fc3f7' }}>{(capacity * parallel).toFixed(1)}</span> Ah
          </div>
        </div>
      </div>

      {/* ── Simulation mode ───────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '24px', marginBottom: '20px' }}>
        <div>
          <div style={{ fontSize: '11px', color: '#fff', textTransform: 'uppercase', letterSpacing: '2px', borderBottom: '1px solid #333', paddingBottom: '5px', marginBottom: '10px' }}>
            Simulation Mode
          </div>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
            {(['const', 'profile', 'regen', 'acc75'] as MotorMode[]).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                style={{
                  background: mode === m ? '#4fc3f7' : '#222',
                  color: mode === m ? '#000' : '#ccc',
                  border: '1px solid #444',
                  padding: '5px 12px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  fontWeight: mode === m ? 'bold' : 'normal',
                }}
              >
                {m === 'acc75' ? '75m Accel' : m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>
          {mode === 'const' && (
            <>
              <ParamGroup label="Start speed" value={constSpeed} onChange={setConstSpeed} min={0} max={200} step={5} unit="km/h" />
              <ParamGroup label="V_target" value={vTarget} onChange={setVTarget} min={10} max={200} step={5} unit="km/h" />
            </>
          )}
          {mode === 'regen' && (
            <>
              <ParamGroup label="Regen power" value={regenPower} onChange={setRegenPower} min={0.5} max={20} step={0.5} unit="kW" />
              <ParamGroup label="Speed" value={regenSpeed} onChange={setRegenSpeed} min={10} max={200} step={5} unit="km/h" />
            </>
          )}
          <ParamGroup label="Duration" value={duration} onChange={setDuration} min={1} max={3600} step={1} unit="s" />
          <ParamGroup label="SOC_0" value={soc0} onChange={setSoc0} min={5} max={100} step={1} unit="%" infoTerm="SOC" />
          <ParamGroup label="T_0" value={t0} onChange={setT0} min={-10} max={50} step={1} unit="°C" />
        </div>

        {mode === 'profile' && (
          <div>
            <div style={{ fontSize: '11px', color: '#fff', textTransform: 'uppercase', letterSpacing: '2px', borderBottom: '1px solid #333', paddingBottom: '5px', marginBottom: '10px' }}>
              Power Profile
            </div>
            <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ color: '#aaa', textAlign: 'left', padding: '3px' }}>Dur (s)</th>
                  <th style={{ color: '#aaa', textAlign: 'left', padding: '3px' }}>Speed (km/h)</th>
                  <th style={{ color: '#aaa', textAlign: 'left', padding: '3px' }}>Power (kW)</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {profileSteps.map((step, idx) => (
                  <tr key={idx}>
                    <td style={{ padding: '2px' }}>
                      <input type="number" value={step.duration_s} onChange={e => updateProfileStep(idx, 'duration_s', parseFloat(e.target.value) || 0)}
                        style={{ width: '60px', background: '#111', color: '#fff', border: '1px solid #444', padding: '3px', fontSize: '12px', textAlign: 'right' }} />
                    </td>
                    <td style={{ padding: '2px' }}>
                      <input type="number" value={step.speed_kmh} onChange={e => updateProfileStep(idx, 'speed_kmh', parseFloat(e.target.value) || 0)}
                        style={{ width: '60px', background: '#111', color: '#fff', border: '1px solid #444', padding: '3px', fontSize: '12px', textAlign: 'right' }} />
                    </td>
                    <td style={{ padding: '2px' }}>
                      <input type="number" value={step.power_kW} onChange={e => updateProfileStep(idx, 'power_kW', parseFloat(e.target.value) || 0)}
                        style={{ width: '60px', background: '#111', color: '#fff', border: '1px solid #444', padding: '3px', fontSize: '12px', textAlign: 'right' }} />
                    </td>
                    <td style={{ padding: '2px' }}>
                      <button onClick={() => removeProfileStep(idx)}
                        style={{ background: '#333', color: '#ef5350', border: 'none', cursor: 'pointer', fontSize: '14px', padding: '2px 6px' }}>x</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button onClick={addProfileStep}
              style={{ marginTop: '6px', background: '#222', color: '#4fc3f7', border: '1px solid #444', padding: '4px 10px', fontSize: '11px', cursor: 'pointer' }}>
              + Add Step
            </button>
          </div>
        )}

        {mode === 'acc75' && (
          <Acc75Panel
            massAcc={massAcc} setMassAcc={setMassAcc}
            CrrAcc={CrrAcc} setCrrAcc={setCrrAcc}
            mu={mu} setMu={setMu}
            fFront={fFront} setFFront={setFFront}
            hCg={hCg} setHCg={setHCg}
            wheelbase={wheelbase} setWheelbase={setWheelbase}
          />
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', justifyContent: 'flex-start' }}>
          <div style={{ fontSize: '11px', color: '#fff', textTransform: 'uppercase', letterSpacing: '2px', borderBottom: '1px solid #333', paddingBottom: '5px', marginBottom: '10px' }}>
            Derived Values
          </div>
          <div style={{ fontSize: '12px', color: '#ccc', lineHeight: 1.8 }}>
            Kt = <span style={{ color: '#4fc3f7' }}>{Kt.toFixed(4)}</span> Nm/A<br />
            V_bat nom = <span style={{ color: '#ffca28' }}>{(vNom * series).toFixed(1)}</span> V<br />
            RPM_max = <span style={{ color: '#4fc3f7' }}>{(kV * vNom * series).toFixed(0)}</span> RPM<br />
            T_motor = <span style={{ color: '#4fc3f7' }}>{(Kt * iPeak).toFixed(2)}</span> Nm @ I_peak<br />
            Wheel speed = <span style={{ color: '#66bb6a' }}>{((kV * vNom * series) / gear / 60 * Math.PI * wheelD / 1000 * 3.6).toFixed(1)}</span> km/h
          </div>
        </div>
      </div>

      {/* ── Control buttons ───────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '14px' }}>
        <button
          onClick={handleStart}
          disabled={sim.running}
          style={{
            background: '#66bb6a', color: '#000', border: 'none',
            padding: '8px 20px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer',
            opacity: sim.running ? 0.4 : 1,
          }}
        >
          {mode === 'acc75' ? 'Run 75m' : 'Start'}
        </button>
        <button
          onClick={sim.reset}
          style={{ background: '#333', color: '#fff', border: '1px solid #444', padding: '8px 16px', fontSize: '13px', cursor: 'pointer' }}
        >
          Reset
        </button>
        {sim.data.length > 0 && (
          <button
            onClick={() => exportMotorCSV(sim.data)}
            style={{ background: '#222', color: '#4fc3f7', border: '1px solid #444', padding: '8px 16px', fontSize: '13px', cursor: 'pointer' }}
          >
            Export CSV
          </button>
        )}
        <span style={{ fontSize: '12px', color: '#888', marginLeft: '8px' }}>{sim.status}</span>
      </div>

      {/* ── 75m result ────────────────────────────────────────────────────── */}
      <Acc75ResultBox result={sim.acc75Result} />

      {/* ── Live values ───────────────────────────────────────────────────── */}
      <MotorLiveValues data={sim.data} />

      {/* ── Charts ────────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        <div>
          <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Power (kW)</div>
          <LineChart
            data={sim.data as unknown as Record<string, number>[]}
            series={[
              { key: 'P_bat_kW', color: '#ef5350', label: 'P_bat' },
              { key: 'P_mech_kW', color: '#66bb6a', label: 'P_mech' },
            ]}
            xKey="t"
            height={180}
            yUnit=" kW"
          />
        </div>
        <div>
          <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Current & Voltage</div>
          <LineChart
            data={sim.data as unknown as Record<string, number>[]}
            series={[
              { key: 'I_bat', color: '#ef5350', label: 'I_bat' },
              { key: 'V_t', color: '#4fc3f7', label: 'V_t', lineWidth: 1 },
            ]}
            xKey="t"
            height={180}
            yUnit=""
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        <div>
          <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Speed & SOC</div>
          <LineChart
            data={sim.data as unknown as Record<string, number>[]}
            series={[
              { key: 'v_kmh', color: '#4fc3f7', label: 'Speed' },
              { key: 'soc', color: '#66bb6a', label: 'SOC', dashed: true },
            ]}
            xKey="t"
            height={180}
            yUnit=""
          />
        </div>
        <div>
          <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Temperature</div>
          <LineChart
            data={sim.data as unknown as Record<string, number>[]}
            series={[
              { key: 'T_motor', color: '#ef5350', label: 'Motor' },
              { key: 'T_esc', color: '#ffa726', label: 'ESC' },
            ]}
            xKey="t"
            height={180}
            yUnit=" °C"
          />
        </div>
      </div>

      {mode === 'acc75' && sim.data.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
          <div>
            <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Distance (m)</div>
            <LineChart
              data={sim.data as unknown as Record<string, number>[]}
              series={[{ key: 'x_m', color: '#ce93d8', label: 'x' }]}
              xKey="t"
              height={180}
              yUnit=" m"
              hLines={[{ value: 75, color: '#66bb6a' }]}
            />
          </div>
          <div>
            <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Traction Ratio</div>
            <LineChart
              data={sim.data as unknown as Record<string, number>[]}
              series={[{ key: 'trac_ratio', color: '#ffca28', label: 'Traction' }]}
              xKey="t"
              height={180}
              yMin={0}
              yMax={1.05}
              yUnit=""
            />
          </div>
        </div>
      )}

      {/* ── Efficiency map ────────────────────────────────────────────────── */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '11px', color: '#fff', textTransform: 'uppercase', letterSpacing: '2px', borderBottom: '1px solid #333', paddingBottom: '5px', marginBottom: '8px' }}>
          Efficiency Map
        </div>
        <EfficiencyMap mc={motorConfig} pack={pack} lastPoint={lastPoint} />
      </div>

      {/* ── Summary ───────────────────────────────────────────────────────── */}
      <MotorSummaryTable data={sim.data} stats={sim.simStats} />
    </div>
  );
}
