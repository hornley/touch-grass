'use client';

type Tab = 'home' | 'stats' | 'achievements';

const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: 'home',         icon: '⬡', label: 'REALM'  },
  { id: 'stats',        icon: '◈', label: 'CODEX'  },
  { id: 'achievements', icon: '✦', label: 'MARKS'  },
];

export function BottomNav({ activeTab, onTabChange }: {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}) {
  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      zIndex: 10,
      background: '#0d1520',
      borderTop: '1px solid #2a3d52',
      display: 'flex',
    }}>
      {TABS.map(tab => {
        const active = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            style={{
              flex: 1,
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              padding: '10px 0 14px',
              gap: '3px',
              background: 'none',
              border: 'none',
              borderTop: active ? '2px solid #d4a030' : '2px solid transparent',
              cursor: 'pointer',
              transition: 'border-color 0.15s, color 0.15s',
            }}
          >
            <span style={{
              fontSize: '20px',
              lineHeight: 1,
              color: active ? '#d4a030' : '#4e6878',
              filter: active ? 'drop-shadow(0 0 5px rgba(212,160,48,0.7))' : 'none',
              transition: 'color 0.15s, filter 0.15s',
            }}>
              {tab.icon}
            </span>
            <span style={{
              fontFamily: 'var(--font-cinzel, serif)',
              fontSize: '8px',
              letterSpacing: '2.5px',
              color: active ? '#d4a030' : '#4e6878',
              transition: 'color 0.15s',
            }}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
