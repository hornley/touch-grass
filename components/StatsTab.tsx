'use client';
import { GameState, QuestHistoryEntry } from '@/lib/types';
import { QUEST_POOL } from '@/lib/game';

function fmt(ms: number): string {
  const m = Math.floor(ms / 60000);
  if (m < 1) return '< 1 MIN';
  if (m < 60) return `${m} MIN`;
  return `${Math.floor(m / 60)}H ${m % 60}M`;
}

function fmtDate(ts: number): string {
  return new Date(ts)
    .toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    .toUpperCase();
}

function fmtTime(ts: number): string {
  return new Date(ts)
    .toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    .toUpperCase();
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '8px 0',
      borderBottom: '1px solid #1e2e3e',
      paddingTop: '2px',
    }}>
      <span style={{ fontSize: '11px', color: '#6a8898', letterSpacing: '1px' }}>{label}</span>
      <span style={{
        fontFamily: 'var(--font-cinzel)', fontSize: '12px', color: '#ead7a0',
      }}>{value}</span>
    </div>
  );
}

const TYPE_ICONS: Record<string, string> = {
  travel: '↝',
  photo: '◉',
  visit: '◎',
  meditate: '◈',
  object: '◇',
  wait: '○',
};

function QuestHistoryList({ history }: { history: QuestHistoryEntry[] }) {
  if (!history || history.length === 0) {
    return (
      <div style={{
        textAlign: 'center', padding: '32px',
        border: '1px dashed #2a3d52', borderRadius: '4px',
        background: 'rgba(23,32,48,0.3)',
      }}>
        <div style={{ fontSize: '24px', marginBottom: '10px', opacity: 0.4 }}>◇</div>
        <div style={{
          fontFamily: 'var(--font-cinzel)', fontSize: '10px', letterSpacing: '3px',
          color: '#4e6878', marginBottom: '6px',
        }}>NO QUESTS RECORDED</div>
        <div style={{ fontSize: '10px', color: '#3a4e60' }}>
          Complete quests to fill your chronicle
        </div>
      </div>
    );
  }

  const reversed = [...history].reverse();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingBottom: '80px' }}>
      {reversed.map((entry, i) => (
        <div key={i} className="rune-panel" style={{
          padding: '10px 14px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: 'var(--font-cinzel)', fontSize: '10px',
              color: '#ead7a0', letterSpacing: '1px', marginBottom: '2px',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {TYPE_ICONS[entry.type] || '○'} {entry.description}
            </div>
            <div style={{ fontSize: '10px', color: '#4e6878' }}>
              {fmtDate(entry.timestamp)} @ {fmtTime(entry.timestamp)}
              {entry.chainId && entry.chainStep && ` • step ${entry.chainStep}`}
            </div>
          </div>
          <div style={{
            fontFamily: 'var(--font-cinzel)', fontSize: '12px',
            color: '#d4a030', marginLeft: '12px', flexShrink: 0,
          }}>
            +{entry.xpEarned}
          </div>
        </div>
      ))}
    </div>
  );
}

export function StatsTab({ gameState }: { gameState: GameState }) {
  const { player, sessions } = gameState;

  const typeMap = Object.fromEntries(QUEST_POOL.map(q => [q.id, q.type]));
  const byType = { travel: 0, photo: 0, wait: 0 };
  for (const id of player.completedQuests) {
    const t = typeMap[id];
    if (t) byType[t as keyof typeof byType]++;
  }

  const distDisplay = player.totalDistance >= 1000
    ? `${(player.totalDistance / 1000).toFixed(2)} KM`
    : `${Math.round(player.totalDistance)} M`;

  const recent = [...sessions].reverse().slice(0, 10);

  return (
    <div style={{ padding: '24px 20px', maxWidth: '480px', margin: '0 auto' }}>

      {/* Expedition log */}
      <div className="section-divider">
        <span className="section-divider__label">EXPEDITION LOG</span>
        <div className="section-divider__line" />
      </div>

      <div className="rune-panel" style={{ padding: '4px 16px', marginBottom: '28px' }}>
        <Row label="TOTAL QUESTS COMPLETED" value={player.completedQuests.length} />
        <Row label="  ◦ TRAVERSE" value={byType.travel} />
        <Row label="  ◦ CAPTURE"  value={byType.photo} />
        <Row label="  ◦ MEDITATE" value={byType.wait} />
        <Row label="DISTANCE WALKED" value={distDisplay} />
        <Row label="CURRENT STREAK"  value={`${player.streak} DAYS`} />
<Row label="RANK"            value={`LEVEL ${player.level}`} />
        <Row label="TOTAL EXPERIENCE" value={`${player.xp} XP`} />
      </div>

      {/* Quest history */}
      <div className="section-divider" style={{ marginTop: '20px' }}>
        <span className="section-divider__label">QUEST HISTORY</span>
        <div className="section-divider__line" />
      </div>

      <QuestHistoryList history={player.questHistory} />

      {/* Session history */}
      <div className="section-divider" style={{ marginTop: '20px' }}>
        <span className="section-divider__label">SESSION HISTORY</span>
        <div className="section-divider__line" />
      </div>

      {recent.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '32px',
          border: '1px dashed #2a3d52', borderRadius: '4px',
          background: 'rgba(23,32,48,0.3)',
        }}>
          <div style={{ fontSize: '24px', marginBottom: '10px', opacity: 0.4 }}>◈</div>
          <div style={{
            fontFamily: 'var(--font-cinzel)', fontSize: '10px', letterSpacing: '3px',
            color: '#4e6878', marginBottom: '6px',
          }}>NO SESSIONS RECORDED</div>
          <div style={{ fontSize: '10px', color: '#3a4e60' }}>
            Complete quests to build your log
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {recent.map((s, i) => (
            <div key={i} className="rune-panel" style={{
              padding: '10px 14px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <div style={{
                  fontFamily: 'var(--font-cinzel)', fontSize: '11px',
                  color: '#ead7a0', letterSpacing: '1px', marginBottom: '2px',
                }}>
                  {fmtDate(s.startTime)}
                </div>
                <div style={{ fontSize: '11px', color: '#4e6878' }}>
                  {fmt(s.endTime - s.startTime)}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{
                  fontFamily: 'var(--font-cinzel)', fontSize: '13px',
                  color: '#d4a030', marginBottom: '2px',
                }}>
                  +{s.xpEarned} XP
                </div>
                <div style={{ fontSize: '11px', color: '#4e6878' }}>
                  {s.questsCompleted} QUEST{s.questsCompleted !== 1 ? 'S' : ''}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
