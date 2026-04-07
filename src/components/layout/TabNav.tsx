interface TabDef {
  id: string;
  label: string;
}

interface TabNavProps {
  tabs: TabDef[];
  active: string;
  onSelect: (id: string) => void;
}

export function TabNav({ tabs, active, onSelect }: TabNavProps) {
  return (
    <div style={{
      display: 'flex',
      gap: 0,
      borderBottom: '1px solid #2a2a2a',
      paddingLeft: '24px',
    }}>
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onSelect(tab.id)}
          style={{
            background: active === tab.id ? '#0e0e14' : '#111',
            color: active === tab.id ? '#fff' : '#666',
            border: '1px solid ' + (active === tab.id ? '#2a2a2a' : '#222'),
            borderBottom: active === tab.id ? '1px solid #0e0e14' : 'none',
            padding: '9px 22px',
            fontFamily: "'Courier New', monospace",
            fontSize: '11px',
            textTransform: 'uppercase',
            letterSpacing: '2px',
            cursor: 'pointer',
            marginBottom: '-1px',
            transition: 'color 0.15s, background 0.15s',
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
