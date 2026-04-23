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
      borderBottom: '1px solid var(--border-dim)',
      paddingLeft: '24px',
      background: 'var(--bg-panel)',
    }}>
      {tabs.map(tab => {
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onSelect(tab.id)}
            style={{
              background: isActive ? 'var(--bg-root)' : 'transparent',
              color: isActive ? 'var(--text-primary)' : 'var(--text-dim)',
              border: '1px solid ' + (isActive ? 'var(--border-dim)' : 'transparent'),
              borderBottom: isActive ? '1px solid var(--bg-root)' : '1px solid transparent',
              padding: '8px 20px',
              fontFamily: "'IBM Plex Mono', 'Courier New', monospace",
              fontSize: '11px',
              textTransform: 'uppercase',
              letterSpacing: '2px',
              cursor: 'pointer',
              marginBottom: '-1px',
              transition: 'color 0.12s, background 0.12s',
            }}
            onMouseEnter={e => {
              if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)';
            }}
            onMouseLeave={e => {
              if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-dim)';
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
