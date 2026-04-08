import { useState } from 'react';
import { TabNav } from './components/layout/TabNav';
import { TabPage } from './components/layout/TabPage';
import { BatteryTab } from './components/battery/BatteryTab';
import { MotorTab } from './components/motor/MotorTab';
import { HybridTab } from './components/hybrid/HybridTab';
import { FormulasTab } from './components/formulas/FormulasTab';
import './App.css';

type Tab = 'battery' | 'motor' | 'hybrid' | 'formulas';

function App() {
  const [tab, setTab] = useState<Tab>('battery');

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0e0e14',
      color: '#ddd',
      fontFamily: "'IBM Plex Mono', 'Courier New', monospace",
    }}>
      {/* Header */}
      <div style={{
        borderBottom: '1px solid #222',
        padding: '12px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
          <span style={{ fontSize: '15px', color: '#fff', fontWeight: 'bold', letterSpacing: '1px' }}>
            FSS-HS-SIM
          </span>
          <span style={{ fontSize: '11px', color: '#555' }}>
            Formula Student Battery + Motor + Endurance Simulator
          </span>
        </div>
        <span style={{ fontSize: '10px', color: '#444' }}>rev 0.2</span>
      </div>

      {/* Navigation */}
      <TabNav
        tabs={[
          { id: 'battery', label: 'Battery' },
          { id: 'motor', label: 'Motor / Drivetrain' },
          { id: 'hybrid', label: 'Hybrid System' },
          { id: 'formulas', label: 'Formulas' },
        ]}
        active={tab}
        onSelect={(id) => setTab(id as Tab)}
      />

      {/* Content */}
      <div style={{ padding: '20px 24px', maxWidth: '1400px', margin: '0 auto' }}>
        <TabPage active={tab === 'battery'}>
          <BatteryTab />
        </TabPage>
        <TabPage active={tab === 'motor'}>
          <MotorTab />
        </TabPage>
        <TabPage active={tab === 'hybrid'}>
          <HybridTab />
        </TabPage>
        <TabPage active={tab === 'formulas'}>
          <FormulasTab />
        </TabPage>
      </div>
    </div>
  );
}

export default App;
