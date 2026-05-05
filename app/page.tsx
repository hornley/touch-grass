'use client';
import { useState, useEffect, useCallback } from 'react';
import { GameState } from '@/lib/types';
import {
  loadGameState,
  saveGameState,
  calculateLevel,
  getXpForNextLevel,
  getRandomQuest,
  getQuestXpMultiplier,
  calculateReturnReward,
  updateStreak,
  checkNewAchievements,
  QUEST_POOL,
  ACHIEVEMENTS,
} from '@/lib/game';
import { useLocation } from '@/lib/useLocation';
import { CameraCapture } from '@/components/CameraCapture';
import { PoseDetection } from '@/components/PoseDetection';
import { ObjectDetection } from '@/components/ObjectDetection';
import { BottomNav } from '@/components/BottomNav';
import { StatsTab } from '@/components/StatsTab';
import { AchievementsTab } from '@/components/AchievementsTab';

type Tab = 'home' | 'stats' | 'achievements';

// ── Helpers ──────────────────────────────────────────────────

function toRoman(n: number): string {
  const vals = [1000,900,500,400,100,90,50,40,10,9,5,4,1];
  const syms = ['M','CM','D','CD','C','XC','L','XL','X','IX','V','IV','I'];
  let r = '';
  for (let i = 0; i < vals.length; i++) while (n >= vals[i]) { r += syms[i]; n -= vals[i]; }
  return r;
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

// Dot-grid background — shared across screens
function DotGrid() {
  return (
    <div style={{
      position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
      backgroundImage: 'radial-gradient(circle, #243a50 1px, transparent 1px)',
      backgroundSize: '30px 30px',
      opacity: 0.45,
    }} />
  );
}

// ── Main component ───────────────────────────────────────────

export default function Home() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [showWelcome, setShowWelcome] = useState<boolean | null>(null);
  const [returnReward, setReturnReward] = useState<{ minutes: number; xp: number } | null>(null);
  const [questMessage, setQuestMessage] = useState<string | null>(null);
  const [achievementToast, setAchievementToast] = useState<string | null>(null);
  const [isTestMode, setIsTestMode] = useState(false);
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [tabFadeKey, setTabFadeKey] = useState(0);

  const lastLocation = gameState?.player.lastLocation ?? null;
  const { location, error, isLoading, isTracking, startTracking, stopTracking, cumulativeDistance, lastMovementDistance } = useLocation(lastLocation, locationEnabled);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('lat') && params.get('lng')) setIsTestMode(true);
  }, []);

  useEffect(() => {
    const loaded = loadGameState();
    const streakResult = updateStreak(loaded.player.lastStreakDate ?? null, loaded.player.streak ?? 0);
    const streakExtended = streakResult.streak > (loaded.player.streak ?? 0);

    const newState: GameState = {
      ...loaded,
      player: {
        ...loaded.player,
        streak: streakResult.streak,
        lastStreakDate: streakResult.lastStreakDate,
        totalDistance: loaded.player.totalDistance ?? 0,
        achievements: loaded.player.achievements ?? [],
        photoQuestsCompleted: loaded.player.photoQuestsCompleted ?? 0,
      },
      sessions: loaded.sessions ?? [],
      currentSession: { startTime: Date.now(), xpEarned: 0, questsCompleted: 0 },
    };

    saveGameState(newState);
    setGameState(newState);

    const isNewUser = loaded.player.xp === 0 && loaded.player.level === 1 && loaded.player.completedQuests.length === 0;
    setShowWelcome(isNewUser);
    if (streakExtended && !isNewUser) setAchievementToast(`🔥 ${streakResult.streak}-DAY STREAK`);
  }, []);

  const showAchievementToasts = useCallback((newIds: string[]) => {
    if (!newIds.length) return;
    const found = ACHIEVEMENTS.find(a => a.id === newIds[0]);
    if (found) setAchievementToast(`${found.icon} ${found.name.toUpperCase()} UNLOCKED`);
  }, []);

  useEffect(() => {
    if (!gameState) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        const now = Date.now();
        setGameState(prev => {
          if (!prev) return prev;
          const sessions = prev.currentSession
            ? [...prev.sessions, {
                startTime: prev.currentSession.startTime,
                endTime: now,
                xpEarned: prev.currentSession.xpEarned,
                questsCompleted: prev.currentSession.questsCompleted,
              }].slice(-20)
            : prev.sessions;
          const s = { ...prev, lastAway: now, sessions, currentSession: null };
          saveGameState(s); return s;
        });
      } else {
        setGameState(prev => {
          if (!prev) return prev;
          const newSession = { startTime: Date.now(), xpEarned: 0, questsCompleted: 0 };
          if (!prev.lastAway) return { ...prev, currentSession: newSession };
          const reward = calculateReturnReward(prev.lastAway);
          if (reward.xp > 0) {
            setReturnReward(reward);
            const newXp = prev.player.xp + reward.xp;
            const s = { ...prev, player: { ...prev.player, xp: newXp, level: calculateLevel(newXp) }, lastAway: null, currentSession: newSession };
            saveGameState(s); return s;
          }
          return { ...prev, lastAway: null, currentSession: newSession };
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', () => { if (gameState) saveGameState(gameState); });
    return () => { document.removeEventListener('visibilitychange', handleVisibilityChange); };
  }, [gameState]);

  useEffect(() => {
    if (!gameState || !location) return;

    if (gameState.currentQuest?.type === 'travel') {
      if (!isTracking) startTracking();
    } else {
      if (isTracking) stopTracking();
    }
  }, [gameState?.currentQuest?.type, isTracking, startTracking, stopTracking]);

  useEffect(() => {
    if (!gameState || !location || lastMovementDistance <= 0) return;

    setGameState(prev => {
      if (!prev) return prev;
      const newDist = (prev.player.totalDistance ?? 0) + lastMovementDistance;
      const newState: GameState = {
        ...prev,
        player: { ...prev.player, lastLocation: location, lastActive: Date.now(), totalDistance: newDist },
      };

      if (prev.currentQuest?.type === 'travel') {
        const progress = prev.currentQuest.progress + lastMovementDistance;
        if (progress >= prev.currentQuest.goal) {
          const xp = Math.round(prev.currentQuest.xpReward * getQuestXpMultiplier(prev.player.level));
          const newXp = prev.player.xp + xp;
          const newLevel = calculateLevel(newXp);
          setQuestMessage(`QUEST COMPLETE  ·  +${xp} XP`);
          newState.player = { ...newState.player, xp: newXp, level: newLevel, completedQuests: [...newState.player.completedQuests, prev.currentQuest.id] };
          newState.currentQuest = getRandomQuest(newState.player.completedQuests, newLevel);
          stopTracking();
          if (newState.currentSession) newState.currentSession = { ...newState.currentSession, xpEarned: newState.currentSession.xpEarned + xp, questsCompleted: newState.currentSession.questsCompleted + 1 };
        } else {
          newState.currentQuest = { ...prev.currentQuest, progress };
        }
      }

      const unlocked = checkNewAchievements(newState);
      if (unlocked.length) { newState.player = { ...newState.player, achievements: [...newState.player.achievements, ...unlocked] }; showAchievementToasts(unlocked); }
      saveGameState(newState); return newState;
    });
  }, [location, lastMovementDistance, stopTracking]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleStart = () => {
    if (!gameState) return;
    setShowWelcome(false);
    setLocationEnabled(true);
    setGameState(prev => {
      if (!prev) return prev;
      const s = { ...prev, currentQuest: getRandomQuest(prev.player.completedQuests, prev.player.level) };
      saveGameState(s); return s;
    });
  };

  const handlePhotoCapture = useCallback(() => {
    if (!gameState?.currentQuest || gameState.currentQuest.type !== 'photo') return;
    setGameState(prev => {
      if (!prev || !prev.currentQuest || prev.currentQuest.type !== 'photo') return prev;
      const xp = Math.round(prev.currentQuest.xpReward * getQuestXpMultiplier(prev.player.level));
      const newXp = prev.player.xp + xp;
      const newLevel = calculateLevel(newXp);
      setQuestMessage(`CAPTURED  ·  +${xp} XP`);
      const completedIds = [...prev.player.completedQuests, prev.currentQuest.id];
      const newState: GameState = {
        ...prev,
        player: { ...prev.player, xp: newXp, level: newLevel, completedQuests: completedIds, photoQuestsCompleted: (prev.player.photoQuestsCompleted ?? 0) + 1 },
        currentQuest: getRandomQuest(completedIds, newLevel),
        
        currentSession: prev.currentSession ? { ...prev.currentSession, xpEarned: prev.currentSession.xpEarned + xp, questsCompleted: prev.currentSession.questsCompleted + 1 } : null,
      };
      const unlocked = checkNewAchievements(newState);
      if (unlocked.length) { newState.player = { ...newState.player, achievements: [...newState.player.achievements, ...unlocked] }; showAchievementToasts(unlocked); }
      saveGameState(newState); return newState;
    });
  }, [gameState, showAchievementToasts]);

  const handleMeditateComplete = useCallback(() => {
    if (!gameState?.currentQuest || gameState.currentQuest.type !== 'meditate') return;
    setGameState(prev => {
      if (!prev || !prev.currentQuest || prev.currentQuest.type !== 'meditate') return prev;
      const xp = Math.round(prev.currentQuest.xpReward * getQuestXpMultiplier(prev.player.level));
      const newXp = prev.player.xp + xp;
      const newLevel = calculateLevel(newXp);
      setQuestMessage(`CENTERED  ·  +${xp} XP`);
      const completedIds = [...prev.player.completedQuests, prev.currentQuest.id];
      const newState: GameState = {
        ...prev,
        player: { ...prev.player, xp: newXp, level: newLevel, completedQuests: completedIds },
        currentQuest: getRandomQuest(completedIds, newLevel),
        
      };
      saveGameState(newState); return newState;
    });
  }, [gameState]);

  const handleObjectComplete = useCallback(() => {
    if (!gameState?.currentQuest || gameState.currentQuest.type !== 'object') return;
    setGameState(prev => {
      if (!prev || !prev.currentQuest || prev.currentQuest.type !== 'object') return prev;
      const xp = Math.round(prev.currentQuest.xpReward * getQuestXpMultiplier(prev.player.level));
      const newXp = prev.player.xp + xp;
      const newLevel = calculateLevel(newXp);
      setQuestMessage(`DISCOVERED  ·  +${xp} XP`);
      const completedIds = [...prev.player.completedQuests, prev.currentQuest.id];
      const newState: GameState = {
        ...prev,
        player: { ...prev.player, xp: newXp, level: newLevel, completedQuests: completedIds },
        currentQuest: getRandomQuest(completedIds, newLevel),
        
      };
      saveGameState(newState); return newState;
    });
  }, [gameState]);

  const skipQuest = useCallback(() => {
    if (!gameState?.currentQuest) return;
    setGameState(prev => {
      if (!prev || !prev.currentQuest) return prev;
      const s = { ...prev, currentQuest: getRandomQuest(prev.player.completedQuests, prev.player.level) };
      saveGameState(s); return s;
    });
  }, [gameState]);

  const resetGame = useCallback(() => {
    const initial = loadGameState();
    Object.assign(initial.player, { xp: 0, level: 1, completedQuests: [], streak: 0, lastStreakDate: null, totalDistance: 0, achievements: [], photoQuestsCompleted: 0 });
    initial.currentQuest = getRandomQuest([], 1);
    initial.sessions = [];
    initial.currentSession = { startTime: Date.now(), xpEarned: 0, questsCompleted: 0 };
    saveGameState(initial);
    setGameState(initial);
  }, []);

  // ── Loading ────────────────────────────────────────────────
  if (!gameState || showWelcome === null) {
    return (
      <div style={{ minHeight: '100vh', background: '#0d1520', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <DotGrid />
        <div className="animate-spin-compass" style={{ width: 40, height: 40, border: '1px solid #2a3d52', borderTop: '1px solid #d4a030', borderRadius: '50%' }} />
      </div>
    );
  }

  // ── Welcome ────────────────────────────────────────────────
  if (showWelcome) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'radial-gradient(ellipse at 50% 35%, #1a3a2a 0%, #0d1520 65%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '32px 24px',
        position: 'relative',
      }}>
        <DotGrid />
        <div style={{ maxWidth: '360px', width: '100%', textAlign: 'center', position: 'relative', zIndex: 1 }} className="animate-fade-up">

          {/* Top date rune */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '36px', color: '#1a3a28' }}>
            <div style={{ flex: 1, height: '1px', background: 'linear-gradient(to right, transparent, #1a3a28)' }} />
            <span style={{ fontFamily: 'var(--font-cinzel)', fontSize: '9px', letterSpacing: '4px', color: '#2a5040' }}>
              ANNO MMXXVI
            </span>
            <div style={{ flex: 1, height: '1px', background: 'linear-gradient(to left, transparent, #1a3a28)' }} />
          </div>

          {/* Title */}
          <h1 style={{
            fontFamily: 'var(--font-cinzel, serif)',
            fontSize: '52px', fontWeight: 900,
            letterSpacing: '0.22em',
            color: '#d4a030',
            textShadow: '0 0 40px rgba(212,160,48,0.5), 0 0 80px rgba(212,160,48,0.15)',
            lineHeight: 1, marginBottom: 0,
          }}>
            TERRA
          </h1>
          <h1 style={{
            fontFamily: 'var(--font-cinzel, serif)',
            fontSize: '52px', fontWeight: 900,
            letterSpacing: '0.22em',
            color: '#d4a030',
            textShadow: '0 0 40px rgba(212,160,48,0.5), 0 0 80px rgba(212,160,48,0.15)',
            lineHeight: 1, marginBottom: '32px',
          }}>
            QUEST
          </h1>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '28px' }}>
            <div style={{ flex: 1, height: '1px', background: '#2a3d52' }} />
            <span style={{ color: '#2a4a38', fontSize: '14px' }}>◆</span>
            <div style={{ flex: 1, height: '1px', background: '#2a3d52' }} />
          </div>

          {/* Tagline */}
          <p style={{
            fontFamily: 'var(--font-inconsolata, monospace)',
            color: '#6a8898', fontSize: '12px', letterSpacing: '1px',
            lineHeight: 1.9, marginBottom: '44px',
          }}>
            YOUR JOURNEY BEGINS NOW.<br />
            TRAVEL. CAPTURE. EXPLORE.<br />
            COMPLETE QUESTS TO RANK UP.
          </p>

          {/* CTA button */}
          <button
            onClick={handleStart}
            style={{
              fontFamily: 'var(--font-cinzel, serif)', fontSize: '12px', letterSpacing: '5px',
              color: '#d4a030', background: 'transparent',
              border: '1px solid #d4a030',
              padding: '16px 44px', cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'block', margin: '0 auto',
            }}
            onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, { background: 'rgba(212,160,48,0.08)', boxShadow: '0 0 24px rgba(212,160,48,0.25)' })}
            onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { background: 'transparent', boxShadow: 'none' })}
          >
            BEGIN JOURNEY
          </button>

          {/* Bottom rune */}
          <div style={{ marginTop: '40px', fontFamily: 'var(--font-cinzel)', color: '#2a3d52', fontSize: '9px', letterSpacing: '4px' }}>
            ◈ YOUR WORLD ◈ YOUR QUEST ◈
          </div>
        </div>
      </div>
    );
  }

  // ── GPS locating ────────────────────────────────────────────
  if (locationEnabled && isLoading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0d1520', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <DotGrid />
        <div style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <div className="animate-spin-compass" style={{
            width: 56, height: 56, margin: '0 auto 24px',
            border: '1px solid #2a3d52',
            borderTop: '1px solid #d4a030',
            borderRadius: '50%',
          }} />
          <p style={{ fontFamily: 'var(--font-cinzel)', fontSize: '11px', letterSpacing: '4px', color: '#d4a030' }} className="animate-flicker">
            LOCATING COORDINATES
          </p>
          <p style={{ fontSize: '11px', color: '#4e6878', marginTop: '8px', letterSpacing: '1px' }}>
            Allow location access when prompted
          </p>
        </div>
      </div>
    );
  }

  // ── Derived values for rendering ────────────────────────────
  const xpForThisLevel = Math.pow(gameState.player.level - 1, 2) * 100;
  const xpForNextLevel = getXpForNextLevel(gameState.player.level);
  const xpProgress = (gameState.player.xp - xpForThisLevel) / (xpForNextLevel - xpForThisLevel);
  const SEG = 10;
  const filledSegs = Math.floor(Math.max(0, Math.min(1, xpProgress)) * SEG);

  const questBadge = gameState.currentQuest && {
    travel: { label: 'TRAVERSE', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.4)' },
    photo:  { label: 'CAPTURE',  color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)', border: 'rgba(139,92,246,0.4)' },
    wait:   { label: 'MEDITATE', color: '#06b6d4', bg: 'rgba(6,182,212,0.1)',  border: 'rgba(6,182,212,0.4)' },
    meditate:{ label: 'YOGA',    color: '#10b981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.4)' },
    object: { label: 'FIND',    color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.4)' },
  }[gameState.currentQuest.type];

  // ── Main game render ────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#0d1520' }}>
      <DotGrid />

      {/* ── Achievement toast ─── */}
      {achievementToast && (
        <div className="animate-slide-down" style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 60,
          background: 'linear-gradient(90deg, #172030, #1e2c3e)',
          borderBottom: '1px solid rgba(212,160,48,0.5)',
          padding: '12px 20px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          boxShadow: '0 4px 24px rgba(212,160,48,0.15)',
        }}>
          <span style={{ fontFamily: 'var(--font-cinzel)', fontSize: '11px', letterSpacing: '2px', color: '#d4a030' }}>
            {achievementToast}
          </span>
          <button onClick={() => setAchievementToast(null)} style={{ color: '#3d4f60', fontSize: '18px', background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>
      )}

      {/* ── Return reward overlay ─── */}
      {returnReward && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50,
          background: 'rgba(13,21,32,0.92)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(4px)',
        }}>
          <div className="rune-panel animate-fade-up" style={{
            padding: '36px 32px', textAlign: 'center', maxWidth: '300px', width: '90%',
            borderColor: '#2a1a5a', boxShadow: '0 0 40px rgba(109,40,217,0.2)',
          }}>
            <p style={{ fontFamily: 'var(--font-cinzel)', color: '#7c3aed', letterSpacing: '4px', fontSize: '9px', marginBottom: '16px' }}>
              WELCOME BACK
            </p>
            <p style={{
              fontFamily: 'var(--font-cinzel)', fontSize: '60px', fontWeight: 900,
              color: '#d4a030', lineHeight: 1, marginBottom: '4px',
              textShadow: '0 0 30px rgba(212,160,48,0.4)',
            }}>
              +{returnReward.xp}
            </p>
            <p style={{ fontFamily: 'var(--font-cinzel)', fontSize: '14px', color: '#5a4020', letterSpacing: '3px', marginBottom: '8px' }}>EXPERIENCE</p>
            <p style={{ fontSize: '11px', color: '#3d4f60', letterSpacing: '1px', marginBottom: '28px' }}>
              {returnReward.minutes} MINUTES AWAY
            </p>
            <button
              onClick={() => setReturnReward(null)}
              style={{
                fontFamily: 'var(--font-cinzel)', fontSize: '10px', letterSpacing: '4px',
                color: '#d4a030', background: 'none', border: '1px solid #d4a030',
                padding: '12px 32px', cursor: 'pointer',
              }}
            >
              CLAIM
            </button>
          </div>
        </div>
      )}

      {/* ── Quest complete message ─── */}
      {questMessage && (
        <div style={{
          position: 'fixed', top: achievementToast ? '48px' : '0', left: 0, right: 0, zIndex: 55,
          background: 'linear-gradient(90deg, #111f18, #172a22)',
          borderBottom: '1px solid rgba(45,110,72,0.6)',
          padding: '11px 20px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          boxShadow: '0 4px 20px rgba(45,110,72,0.12)',
        }}>
          <span style={{ fontFamily: 'var(--font-cinzel)', fontSize: '11px', letterSpacing: '2px', color: '#4ade80' }}>
            {questMessage}
          </span>
          <button onClick={() => setQuestMessage(null)} style={{ color: '#3d4f60', fontSize: '18px', background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>
      )}

      {/* ── Main content ─── */}
      <main style={{ flex: 1, overflowY: 'auto', paddingBottom: '72px', position: 'relative', zIndex: 1 }}>

        {activeTab === 'home' && (
          <div style={{ padding: '20px 16px', maxWidth: '480px', margin: '0 auto' }}>

            {isTestMode && (
              <div style={{
                fontFamily: 'var(--font-cinzel)', fontSize: '9px', letterSpacing: '3px',
                color: '#854d0e', background: '#1c0e00', border: '1px solid #78350f',
                padding: '8px 14px', marginBottom: '12px', textAlign: 'center',
              }}>
                ⚠ TEST MODE — COORDINATES SIMULATED
              </div>
            )}

            {/* Debug panel */}
            {true && (
              <div style={{
                background: '#111820', border: '1px solid #92400e',
                padding: '12px 14px', marginBottom: '14px',
                fontFamily: 'var(--font-inconsolata, monospace)',
              }}>
                <div style={{ fontSize: '9px', letterSpacing: '3px', color: '#a05020', marginBottom: '10px' }}>
                  ⚠ DEBUG TERMINAL
                </div>

                {/* Player state */}
                <div style={{ fontSize: '10px', color: '#6a8898', marginBottom: '10px', padding: '8px', background: '#0d1520', borderRadius: '4px' }}>
                  <div style={{ display: 'flex', gap: '16px', marginBottom: '4px' }}>
                    <span>XP: <span style={{ color: '#d4a030' }}>{gameState.player.xp}</span></span>
                    <span>LVL: <span style={{ color: '#d4a030' }}>{gameState.player.level}</span></span>
                    <span>STREAK: <span style={{ color: '#f59e0b' }}>{gameState.player.streak}</span></span>
                  </div>
                  
                </div>

                {/* Current quest */}
                <div style={{ fontSize: '10px', color: '#4e6878', marginBottom: '8px' }}>
                  CURRENT: {gameState.currentQuest ? (
                    <span style={{ color: '#d4bc8a' }}>{gameState.currentQuest.type} ({gameState.currentQuest.xpReward}xp)</span>
                  ) : (
                    <span style={{ color: '#ef4444' }}>NONE</span>
                  )}
                </div>

                {/* Quest pool */}
                <div style={{ fontSize: '9px', color: '#4e6878', marginBottom: '10px' }}>
                  QUEST POOL:
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px', maxHeight: '100px', overflowY: 'auto' }}>
                  {QUEST_POOL.map(q => {
                    const isCompleted = gameState.player.completedQuests.includes(q.id);
                    const canPlay = (q.minLevel ?? 1) <= gameState.player.level;
                    return (
                      <button
                        key={q.id}
                        onClick={() => {
                          if (!isCompleted && canPlay) {
                            setGameState(prev => {
                              if (!prev) return prev;
                              const s = { ...prev, currentQuest: { ...q, status: 'active' as const, progress: 0 } };
                              saveGameState(s); return s;
                            });
                          }
                        }}
                        disabled={isCompleted || !canPlay}
                        style={{
                          fontSize: '9px', padding: '3px 8px',
                          color: isCompleted ? '#3a4e60' : canPlay ? '#6a8898' : '#3a4e60',
                          background: isCompleted ? 'transparent' : canPlay ? '#1e2e3e' : 'transparent',
                          border: `1px solid ${isCompleted ? '#1e2e3e' : canPlay ? '#2a3d52' : '#1e2e3e'}`,
                          cursor: isCompleted || !canPlay ? 'default' : 'pointer',
                          textDecoration: isCompleted ? 'line-through' : 'none',
                        }}
                      >
                        {q.type}:{q.xpReward}{q.minLevel ? ` L${q.minLevel}` : ''}
                      </button>
                    );
                  })}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={skipQuest} style={{ fontSize: '10px', color: '#93c5fd', background: 'none', border: '1px solid #1e3a5f', padding: '4px 12px', cursor: 'pointer', fontFamily: 'var(--font-cinzel)' }}>
                    SKIP QUEST
                  </button>
                  <button onClick={resetGame} style={{ fontSize: '10px', color: '#fca5a5', background: 'none', border: '1px solid #5f1e1e', padding: '4px 12px', cursor: 'pointer', fontFamily: 'var(--font-cinzel)' }}>
                    RESET GAME
                  </button>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* ── Player card ─── */}
              <div className="rune-panel" style={{ padding: '20px' }}>
                <SectionHeader
                  label="TERRAQUEST"
                  right={
                    <span style={{ fontFamily: 'var(--font-cinzel)', fontSize: '18px', color: '#d4a030', letterSpacing: '2px', whiteSpace: 'nowrap', textShadow: '0 0 12px rgba(212,160,48,0.4)' }}>
                      RANK {toRoman(gameState.player.level)}
                    </span>
                  }
                />

                {/* XP segments */}
                <div className="seg-bar" style={{ marginBottom: '10px' }}>
                  {Array.from({ length: SEG }).map((_, i) => (
                    <div key={i} className={`seg-bar__cell${i < filledSegs ? ' seg-bar__cell--filled' : ''}`} />
                  ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '10px', color: '#6a8898', letterSpacing: '1px' }}>
                    {gameState.player.xp} XP &nbsp;·&nbsp; NEXT {xpForNextLevel} XP
                    {gameState.player.level >= 3 && (
                      <span style={{ color: '#d4a030' }}> &nbsp;·&nbsp; ×{getQuestXpMultiplier(gameState.player.level).toFixed(1)} BONUS</span>
                    )}
                  </span>
                  {gameState.player.streak > 0 && (
                    <span style={{ fontFamily: 'var(--font-cinzel)', fontSize: '10px', color: '#f59e0b', letterSpacing: '1px' }}>
                      🔥 {gameState.player.streak}D
                    </span>
                  )}
                </div>
              </div>

              {/* ── Quest card ─── */}
              <div key={gameState.currentQuest?.id} className="rune-panel animate-quest" style={{ padding: '20px' }}>
                <SectionHeader
                  label="ACTIVE QUEST"
                  right={questBadge ? (
                    <span style={{
                      fontFamily: 'var(--font-cinzel)', fontSize: '9px', letterSpacing: '2px',
                      color: questBadge.color, background: questBadge.bg,
                      border: `1px solid ${questBadge.border}`,
                      padding: '2px 8px', whiteSpace: 'nowrap',
                    }}>
                      {questBadge.label}
                    </span>
                  ) : undefined}
                />

                {gameState.currentQuest ? (
                  <div>
                    <p style={{
                      fontSize: '15px', color: '#d4bc8a', lineHeight: 1.7,
                      marginBottom: '18px', letterSpacing: '0.3px',
                    }}>
                      {gameState.currentQuest.description}
                    </p>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                      <span style={{ fontFamily: 'var(--font-cinzel)', fontSize: '10px', color: '#6a8898', letterSpacing: '1px' }}>
                        REWARD
                      </span>
                      <span style={{ fontFamily: 'var(--font-cinzel)', fontSize: '14px', color: '#d4a030' }}>
                        +{Math.round(gameState.currentQuest.xpReward * getQuestXpMultiplier(gameState.player.level))} XP
                      </span>
                    </div>

                    {gameState.currentQuest.type === 'travel' && (
                      <div>
                        <div style={{ height: '5px', background: '#172030', border: '1px solid #2a3d52', overflow: 'hidden', marginBottom: '6px' }}>
                          <div style={{
                            height: '100%',
                            width: `${Math.min(100, (gameState.currentQuest.progress / gameState.currentQuest.goal) * 100)}%`,
                            background: 'linear-gradient(90deg, #1e3a8a, #3b82f6)',
                            transition: 'width 0.5s ease',
                          }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '10px', color: '#6a8898' }}>PROGRESS</span>
                          <span style={{ fontFamily: 'var(--font-cinzel)', fontSize: '11px', color: '#93c5fd' }}>
                            {Math.round(gameState.currentQuest.progress)} M &nbsp;╱&nbsp; {gameState.currentQuest.goal} M
                          </span>
                        </div>
                      </div>
                    )}

                    {gameState.currentQuest.type === 'photo' && (
                      <CameraCapture onCapture={handlePhotoCapture} />
                    )}

                    {gameState.currentQuest.type === 'wait' && (
                      <p style={{ fontSize: '11px', color: '#6a8898', letterSpacing: '1px' }}>
                        Leave the app for 5+ minutes, then return to claim your reward.
                      </p>
                    )}

                    {gameState.currentQuest.type === 'meditate' && (
                      <PoseDetection
                        duration={gameState.currentQuest.goal}
                        onComplete={handleMeditateComplete}
                      />
                    )}

                    {gameState.currentQuest.type === 'object' && (
                      <ObjectDetection
                        targetObject={gameState.currentQuest.targetObject || 'tree'}
                        onComplete={handleObjectComplete}
                      />
                    )}
                  </div>
                ) : (
                  <div style={{
                    textAlign: 'center', padding: '20px',
                    border: '1px dashed #2a3d52', borderRadius: '4px',
                    background: 'rgba(23,32,48,0.3)',
                  }}>
                    <div style={{ fontSize: '24px', marginBottom: '8px', opacity: 0.4 }}>⬡</div>
                    <p style={{
                      fontFamily: 'var(--font-cinzel)', fontSize: '10px',
                      letterSpacing: '3px', color: '#4e6878',
                    }}>NO ACTIVE QUEST</p>
                    <p style={{
                      fontSize: '10px', color: '#3a4e60', marginTop: '8px',
                    }}>Complete current quest to receive next</p>
                  </div>
                )}
              </div>

              {/* ── Location card ─── */}
              <div className="rune-panel" style={{ padding: '16px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: 'var(--font-cinzel)', fontSize: '10px', letterSpacing: '3px', color: '#7a9aac' }}>
                    COORDINATES
                  </span>
                  {location && (
                    <span style={{ fontFamily: 'var(--font-inconsolata, monospace)', fontSize: '12px', color: '#85a885' }}>
                      {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
                    </span>
                  )}
                </div>
                {(isLoading || error || !location) && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    marginTop: '8px', padding: '8px 0',
                  }}>
                    {isLoading ? (
                      <>
                        <span className="animate-spin-compass" style={{ fontSize: '14px', color: '#d4a030' }}>◐</span>
                        <span style={{ fontSize: '11px', color: '#d4a030', letterSpacing: '2px', fontFamily: 'var(--font-cinzel)' }}>ACQUIRING SIGNAL</span>
                      </>
                    ) : error ? (
                      <>
                        <span style={{ fontSize: '14px', color: '#ef4444' }}>⚠</span>
                        <span style={{ fontSize: '11px', color: '#ef4444', letterSpacing: '2px', fontFamily: 'var(--font-cinzel)' }}>{error.toUpperCase()}</span>
                      </>
                    ) : location ? (
                      <>
                        {isTracking && (
                          <span style={{ fontSize: '14px', color: '#4ade80', marginRight: '6px' }}>●</span>
                        )}
                        <span style={{ fontSize: '11px', color: '#6a8898', letterSpacing: '1px' }}>
                          {isTracking && cumulativeDistance > 0
                            ? `TRACKING: ${Math.round(cumulativeDistance)} M`
                            : location.lat.toFixed(5) + ', ' + location.lng.toFixed(5)}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="animate-flicker" style={{ fontSize: '14px', color: '#4e6878' }}>◦</span>
                        <span style={{ fontSize: '11px', color: '#4e6878', letterSpacing: '2px', fontFamily: 'var(--font-cinzel)' }}>AWAITING SIGNAL</span>
                      </>
                    )}
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

        <div key={tabFadeKey} className="animate-tab-fade">
          {activeTab === 'stats' && <StatsTab gameState={gameState} />}
          {activeTab === 'achievements' && <AchievementsTab unlockedIds={gameState.player.achievements} />}
        </div>
      </main>

      <BottomNav activeTab={activeTab} onTabChange={(tab) => { setActiveTab(tab); setTabFadeKey(k => k + 1); }} />
    </div>
  );
}
