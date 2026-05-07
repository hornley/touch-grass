// components/LeaderboardTab.tsx
'use client';
import { useState, useEffect, useCallback } from 'react';
import { GameState } from '@/lib/types';

interface LeaderboardEntry {
  rank: number;
  playerId: string;
  username: string;
  level: number;
  xp: number;
  questsCompleted: number;
  totalDistance: number;
}

interface NearbyPlayer {
  playerId: string;
  username: string;
  level: number;
  lastLocation: { lat: number; lng: number };
  distanceM: number;
}

type LeaderboardType = 'quests' | 'level';

const HIDE_TEST_PLACEHOLDERS = true;

function isTestPlaceholder(entry: LeaderboardEntry | NearbyPlayer): boolean {
  if (!HIDE_TEST_PLACEHOLDERS) return false;
  const isTraveler = /^Traveler #/.test(entry.username);
  const isLevelOne = entry.level === 1;
  // nearby uses level only, leaderboard uses questsCompleted
  const hasNoProgress = 'questsCompleted' in entry 
    ? (entry.level === 1 && entry.xp === 0 && entry.questsCompleted === 0)
    : (entry.level === 1);
  return isTraveler && hasNoProgress;
}

function SectionHeader({ label, right }: { label: string; right?: React.ReactNode }) {
  return (
    <div className="section-divider">
      <span className="section-divider__label">{label}</span>
      <div className="section-divider__line" />
      {right}
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const colors = { 1: '#ffd700', 2: '#c0c0c0', 3: '#cd7f32' };
  const color = colors[rank as keyof typeof colors] || '#4e6878';
  return (
    <span style={{
      width: '24px', height: '24px', display: 'inline-flex',
      alignItems: 'center', justifyContent: 'center',
      borderRadius: '50%',
      border: `1px solid ${color}`,
      background: rank <= 3 ? `${color}18` : 'transparent',
      fontFamily: 'var(--font-cinzel)',
      fontSize: rank <= 3 ? '11px' : '10px',
      color,
      flexShrink: 0,
    }}>
      {rank}
    </span>
  );
}

function DistanceBadge({ meters }: { meters: number }) {
  if (meters < 1000) return <span style={{ fontSize: '10px', color: '#4e6878' }}>{Math.round(meters)}m away</span>;
  return <span style={{ fontSize: '10px', color: '#4e6878' }}>{(meters / 1000).toFixed(1)}km away</span>;
}

export function LeaderboardTab({ gameState }: { gameState: GameState }) {
  const [leaderboardType, setLeaderboardType] = useState<LeaderboardType>('quests');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [nearby, setNearby] = useState<NearbyPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [nearbyLoading, setNearbyLoading] = useState(false);

  const fetchLeaderboard = useCallback(async (type: LeaderboardType) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/leaderboard?type=${type}&limit=100`);
      const data = await res.json();
      setLeaderboard(data.leaderboard ?? []);
    } catch {
      setLeaderboard([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchNearby = useCallback(async (lat: number, lng: number, playerId?: string) => {
    setNearbyLoading(true);
    try {
      const res = await fetch(`/api/presence?lat=${lat}&lng=${lng}&radius=500${playerId ? `&playerId=${playerId}` : ''}`);
      const data = await res.json();
      setNearby(data.nearby ?? []);
    } catch {
      setNearby([]);
    } finally {
      setNearbyLoading(false);
    }
  }, []);

  const playerId = gameState.player.playerId;

  useEffect(() => {
    fetchLeaderboard(leaderboardType);
  }, [leaderboardType, fetchLeaderboard]);

  useEffect(() => {
    const loc = gameState.player.lastLocation;
    if (loc?.lat && loc?.lng) {
      fetchNearby(loc.lat, loc.lng, playerId);
    }
  }, [gameState, fetchNearby, playerId]);

  return (
    <div style={{ padding: '24px 20px', maxWidth: '480px', margin: '0 auto' }}>

      {/* Leaderboard */}
      <SectionHeader label="RIVALS" right={
        <div style={{ display: 'flex', gap: '4px' }}>
          {(['quests', 'level'] as LeaderboardType[]).map(t => (
            <button
              key={t}
              onClick={() => setLeaderboardType(t)}
              style={{
                fontFamily: 'var(--font-cinzel)',
                fontSize: '8px',
                letterSpacing: '2px',
                padding: '3px 10px',
                border: `1px solid ${leaderboardType === t ? '#d4a030' : '#2a3d52'}`,
                background: leaderboardType === t ? 'rgba(212,160,48,0.08)' : 'transparent',
                color: leaderboardType === t ? '#d4a030' : '#4e6878',
                cursor: 'pointer',
              }}
            >
              {t === 'quests' ? 'QUESTS' : 'LEVEL'}
            </button>
          ))}
        </div>
      } />

      <div style={{ marginBottom: '28px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '32px', color: '#4e6878', fontSize: '11px', letterSpacing: '2px', fontFamily: 'var(--font-cinzel)' }}>
            LOADING...
          </div>
        ) : leaderboard.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '32px',
            border: '1px dashed #2a3d52', borderRadius: '4px',
            background: 'rgba(23,32,48,0.3)',
          }}>
            <div style={{ fontSize: '24px', marginBottom: '10px', opacity: 0.4 }}>⬡</div>
            <div style={{ fontFamily: 'var(--font-cinzel)', fontSize: '10px', letterSpacing: '3px', color: '#4e6878' }}>
              NO RIVALS YET
            </div>
            <div style={{ fontSize: '10px', color: '#3a4e60', marginTop: '8px' }}>
              Be the first to claim your place
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {leaderboard.slice(0, 50).filter(e => !isTestPlaceholder(e)).map(entry => {
              const isMe = entry.playerId === playerId;
              return (
                <div key={entry.playerId} className="rune-panel" style={{
                  padding: '10px 14px',
                  display: 'flex', alignItems: 'center', gap: '12px',
                  border: isMe ? '1px solid #d4a030' : undefined,
                  background: isMe ? 'rgba(212,160,48,0.05)' : undefined,
                }}>
                  <RankBadge rank={entry.rank} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: 'var(--font-cinzel)', fontSize: '12px',
                      color: isMe ? '#d4a030' : '#ead7a0',
                      letterSpacing: '1px',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {entry.username}{isMe ? ' (YOU)' : ''}
                    </div>
                    <div style={{ fontSize: '10px', color: '#4e6878' }}>
                      LVL {entry.level} • {entry.questsCompleted} quests
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontFamily: 'var(--font-cinzel)', fontSize: '11px', color: '#6a8898' }}>
                      {leaderboardType === 'quests' ? entry.questsCompleted : `LVL ${entry.level}`}
                    </div>
                    <div style={{ fontSize: '10px', color: '#4e6878' }}>
                      {entry.xp} XP
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Nearby players */}
      <SectionHeader label="NEARBY TRAVELERS" />
      <div style={{ paddingBottom: '80px' }}>
        {nearbyLoading ? (
          <div style={{ textAlign: 'center', padding: '24px', color: '#4e6878', fontSize: '11px', letterSpacing: '2px', fontFamily: 'var(--font-cinzel)' }}>
            SCANNING...
          </div>
        ) : nearby.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '32px',
            border: '1px dashed #2a3d52', borderRadius: '4px',
            background: 'rgba(23,32,48,0.3)',
          }}>
            <div style={{ fontSize: '24px', marginBottom: '10px', opacity: 0.4 }}>◎</div>
            <div style={{ fontFamily: 'var(--font-cinzel)', fontSize: '10px', letterSpacing: '3px', color: '#4e6878' }}>
              NO ONE NEARBY
            </div>
            <div style={{ fontSize: '10px', color: '#3a4e60', marginTop: '8px' }}>
              Be within 500m of another player to see them
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {nearby.filter(e => !isTestPlaceholder(e)).map(player => {
              const isMe = player.playerId === playerId;
              return (
                <div key={player.playerId} className="rune-panel" style={{
                  padding: '10px 14px',
                  display: 'flex', alignItems: 'center', gap: '12px',
                  border: isMe ? '1px solid #d4a030' : undefined,
                }}>
                  <div style={{
                    width: '8px', height: '8px',
                    background: '#10b981',
                    borderRadius: '50%',
                    boxShadow: '0 0 6px rgba(16,185,129,0.8)',
                    flexShrink: 0,
                  }} />
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontFamily: 'var(--font-cinzel)', fontSize: '11px',
                      color: isMe ? '#d4a030' : '#ead7a0',
                      letterSpacing: '1px',
                    }}>
                      {player.username}{isMe ? ' (YOU)' : ''}
                    </div>
                    <DistanceBadge meters={player.distanceM} />
                  </div>
                  <div style={{
                    fontFamily: 'var(--font-cinzel)', fontSize: '10px', color: '#6a8898',
                  }}>
                    LVL {player.level}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}