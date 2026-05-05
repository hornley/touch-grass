'use client';
import { ACHIEVEMENTS } from '@/lib/game';

export function AchievementsTab({ unlockedIds }: { unlockedIds: string[] }) {
  const unlocked = new Set(unlockedIds);

  return (
    <div style={{ padding: '24px 20px', maxWidth: '480px', margin: '0 auto' }}>
      {/* Header */}
      <div className="section-divider">
        <span className="section-divider__label">MARKS OF HONOUR</span>
        <div className="section-divider__line" />
        <span style={{
          fontFamily: 'var(--font-cinzel)', fontSize: '10px', letterSpacing: '2px',
          color: '#6a8898', whiteSpace: 'nowrap',
        }}>
          {unlockedIds.length} ╱ {ACHIEVEMENTS.length}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        {ACHIEVEMENTS.map(a => {
          const isUnlocked = unlocked.has(a.id);
          return (
            <div
              key={a.id}
              className="rune-panel"
              style={{
                padding: '18px 16px',
                borderColor: isUnlocked ? '#2a4a2a' : '#1e2e3e',
                boxShadow: isUnlocked ? '0 0 18px rgba(74,222,128,0.04)' : 'none',
              }}
            >
              {isUnlocked && (
                <div style={{
                  position: 'absolute', top: 0, right: 0,
                  width: 0, height: 0,
                  borderTop: '18px solid #2d6e48',
                  borderLeft: '18px solid transparent',
                }} />
              )}
              <div style={{
                fontSize: '30px',
                marginBottom: '10px',
                filter: isUnlocked ? 'none' : 'grayscale(1) brightness(0.3)',
                lineHeight: 1,
              }}>
                {isUnlocked ? a.icon : '◻'}
              </div>
              <div style={{
                fontFamily: 'var(--font-cinzel)',
                fontSize: '10px',
                letterSpacing: '1.5px',
                color: isUnlocked ? '#ead7a0' : '#3a4e60',
                marginBottom: '6px',
              }}>
                {a.name.toUpperCase()}
              </div>
              <div style={{
                fontFamily: 'var(--font-inconsolata, monospace)',
                fontSize: '12px',
                color: isUnlocked ? '#7a9aac' : '#2a3a4a',
                lineHeight: 1.5,
              }}>
                {a.description}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
