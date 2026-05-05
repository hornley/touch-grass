'use client';
import { useState, useEffect, useCallback } from 'react';
import { GameState } from '@/lib/types';
import {
  loadGameState,
  saveGameState,
  calculateLevel,
  getXpForNextLevel,
  getRandomQuest,
  updateWorldState,
  reduceCorruption,
  calculateReturnReward,
  QUEST_POOL,
} from '@/lib/game';
import { useLocation } from '@/lib/useLocation';
import { CameraCapture } from '@/components/CameraCapture';
import { PoseDetection } from '@/components/PoseDetection';
import { ObjectDetection } from '@/components/ObjectDetection';

export default function Home() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [showWelcome, setShowWelcome] = useState<boolean | null>(null);
  const [returnReward, setReturnReward] = useState<{ minutes: number; xp: number } | null>(null);
  const [questMessage, setQuestMessage] = useState<string | null>(null);
  const [isTestMode, setIsTestMode] = useState(false);
  const [locationEnabled, setLocationEnabled] = useState(false);

  const lastLocation = gameState?.player.lastLocation ?? null;
  const { location, error, isLoading, distanceFromLast } = useLocation(lastLocation, locationEnabled);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('lat') && params.get('lng')) {
      setIsTestMode(true);
    }
  }, []);

  useEffect(() => {
    const loaded = loadGameState();
    const updatedWorld = updateWorldState(loaded.player.lastActive, loaded.world);
    setGameState({ ...loaded, world: updatedWorld });
    const isNewUser = loaded.player.xp === 0 && loaded.player.level === 1 && loaded.player.completedQuests.length === 0;
    setShowWelcome(isNewUser);
  }, []);

  useEffect(() => {
    if (!gameState) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        const now = Date.now();
        setGameState(prev => {
          if (!prev) return prev;
          const newState = { ...prev, lastAway: now };
          saveGameState(newState);
          return newState;
        });
      } else {
        setGameState(prev => {
          if (!prev || !prev.lastAway) return prev;
          const reward = calculateReturnReward(prev.lastAway);
          if (reward.xp > 0) {
            setReturnReward(reward);
            const newXp = prev.player.xp + reward.xp;
            const newLevel = calculateLevel(newXp);
            const newState = {
              ...prev,
              player: { ...prev.player, xp: newXp, level: newLevel },
              lastAway: null,
            };
            saveGameState(newState);
            return newState;
          }
          return { ...prev, lastAway: null };
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', () => {
      if (gameState) saveGameState(gameState);
    });

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', () => {});
    };
  }, [gameState]);

  useEffect(() => {
    if (!gameState || !location || distanceFromLast === null) return;
    if (distanceFromLast <= 100) return;

    setGameState(prev => {
      if (!prev) return prev;
      const newState = {
        ...prev,
        player: {
          ...prev.player,
          lastLocation: location,
          lastActive: Date.now(),
        },
        world: reduceCorruption(prev.world),
      };

      if (prev.currentQuest?.type === 'travel') {
        const newProgress = prev.currentQuest.progress + distanceFromLast;
        if (newProgress >= prev.currentQuest.goal) {
          const newXp = prev.player.xp + prev.currentQuest.xpReward;
          const newLevel = calculateLevel(newXp);
          setQuestMessage(`Quest complete! +${prev.currentQuest.xpReward} XP`);
          newState.player = { ...newState.player, xp: newXp, level: newLevel };
          newState.player.completedQuests = [...newState.player.completedQuests, prev.currentQuest.id];
          newState.currentQuest = getRandomQuest(newState.player.completedQuests);
        } else {
          newState.currentQuest = { ...prev.currentQuest, progress: newProgress };
        }
      } else {
        newState.currentQuest = getRandomQuest(prev.player.completedQuests);
      }

      saveGameState(newState);
      return newState;
    });
  }, [location, distanceFromLast]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleStart = () => {
    if (!gameState) return;
    setShowWelcome(false);
    setLocationEnabled(true);
    setGameState(prev => {
      if (!prev) return prev;
      const newQuest = getRandomQuest(prev.player.completedQuests);
      const newState = { ...prev, currentQuest: newQuest };
      saveGameState(newState);
      return newState;
    });
  };

  const handlePhotoCapture = useCallback(() => {
    if (!gameState?.currentQuest || gameState.currentQuest.type !== 'photo') return;
    setGameState(prev => {
      if (!prev || !prev.currentQuest || prev.currentQuest.type !== 'photo') return prev;
      const newXp = prev.player.xp + prev.currentQuest.xpReward;
      const newLevel = calculateLevel(newXp);
      setQuestMessage(`Photo captured! +${prev.currentQuest.xpReward} XP`);
      const newState = {
        ...prev,
        player: {
          ...prev.player,
          xp: newXp,
          level: newLevel,
          completedQuests: [...prev.player.completedQuests, prev.currentQuest.id],
        },
        currentQuest: getRandomQuest([...prev.player.completedQuests, prev.currentQuest.id]),
        world: reduceCorruption(prev.world),
      };
      saveGameState(newState);
      return newState;
    });
  }, [gameState]);

  const handleMeditateComplete = useCallback(() => {
    if (!gameState?.currentQuest || gameState.currentQuest.type !== 'meditate') return;
    setGameState(prev => {
      if (!prev || !prev.currentQuest || prev.currentQuest.type !== 'meditate') return prev;
      const newXp = prev.player.xp + prev.currentQuest.xpReward;
      const newLevel = calculateLevel(newXp);
      setQuestMessage(`Meditation complete! +${prev.currentQuest.xpReward} XP`);
      const newState = {
        ...prev,
        player: {
          ...prev.player,
          xp: newXp,
          level: newLevel,
          completedQuests: [...prev.player.completedQuests, prev.currentQuest.id],
        },
        currentQuest: getRandomQuest([...prev.player.completedQuests, prev.currentQuest.id]),
        world: reduceCorruption(prev.world),
      };
      saveGameState(newState);
      return newState;
    });
  }, [gameState]);

  const handleObjectComplete = useCallback(() => {
    if (!gameState?.currentQuest || gameState.currentQuest.type !== 'object') return;
    setGameState(prev => {
      if (!prev || !prev.currentQuest || prev.currentQuest.type !== 'object') return prev;
      const newXp = prev.player.xp + prev.currentQuest.xpReward;
      const newLevel = calculateLevel(newXp);
      setQuestMessage(`Found it! +${prev.currentQuest.xpReward} XP`);
      const newState = {
        ...prev,
        player: {
          ...prev.player,
          xp: newXp,
          level: newLevel,
          completedQuests: [...prev.player.completedQuests, prev.currentQuest.id],
        },
        currentQuest: getRandomQuest([...prev.player.completedQuests, prev.currentQuest.id]),
        world: reduceCorruption(prev.world),
      };
      saveGameState(newState);
      return newState;
    });
  }, [gameState]);

  const dismissReturnReward = () => {
    setReturnReward(null);
  };

  const dismissQuestMessage = () => {
    setQuestMessage(null);
  };

  const skipQuest = useCallback(() => {
    if (!gameState?.currentQuest) return;
    setGameState(prev => {
      if (!prev || !prev.currentQuest) return prev;
      const newState = {
        ...prev,
        currentQuest: getRandomQuest(prev.player.completedQuests),
      };
      saveGameState(newState);
      return newState;
    });
  }, [gameState]);

  const resetGame = useCallback(() => {
    const initial = loadGameState();
    initial.player.xp = 0;
    initial.player.level = 1;
    initial.player.completedQuests = [];
    initial.currentQuest = getRandomQuest([]);
    initial.world.corruption = 0;
    initial.world.state = 'stable';
    saveGameState(initial);
    setGameState(initial);
  }, []);

  if (!gameState) {
    return <div className="p-8 text-white">Loading...</div>;
  }

  if (showWelcome === null) {
    return <div className="p-8 text-white">Loading...</div>;
  }

  if (showWelcome) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-800 to-green-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl p-8 max-w-md text-center shadow-2xl">
          <h1 className="text-3xl font-bold text-green-800 mb-4">TerraQuest</h1>
          <p className="text-gray-600 mb-6">
            A real-world RPG where your movements affect the game world. Complete quests by traveling
            and taking photos to save the realm from corruption.
          </p>
          <button
            onClick={handleStart}
            className="bg-green-600 text-white px-8 py-3 rounded-full font-semibold text-lg hover:bg-green-700 transition-colors"
          >
            Get Started
          </button>
        </div>
      </div>
    );
  }

  if (locationEnabled && isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex items-center justify-center p-4">
        <div className="text-white text-center">
          <div className="text-4xl mb-4">📍</div>
          <p className="text-xl font-semibold">Getting your location...</p>
          <p className="text-gray-400 mt-2">Please allow location access when prompted</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 text-white p-4">
      {isTestMode && (
        <div className="bg-yellow-600 text-yellow-100 px-4 py-2 rounded text-center font-bold mb-4">
          TEST MODE - Coordinates simulated
        </div>
      )}

      {true && (
        <div className="bg-slate-800 p-4 rounded-lg mb-4 border border-yellow-500">
          <h3 className="font-bold text-yellow-400 mb-2">Debug Controls</h3>
          <div className="flex flex-wrap gap-2">
            <button onClick={skipQuest} className="bg-blue-600 text-white px-3 py-1 rounded text-sm">
              Skip Quest
            </button>
            <button onClick={resetGame} className="bg-red-600 text-white px-3 py-1 rounded text-sm">
              Reset Game
            </button>
          </div>
          <div className="mt-3 text-xs text-gray-400">
            <p className="font-semibold">Available Quests:</p>
            <div className="flex flex-wrap gap-1 mt-1">
              {QUEST_POOL.map(q => (
                <span key={q.id} className="bg-slate-700 px-2 py-0.5 rounded">
                  {q.type}: {q.xpReward}XP
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {returnReward && (
        <div className="bg-purple-600 p-4 rounded-lg mb-4 text-center animate-pulse">
          <p className="font-bold text-lg">Welcome Back!</p>
          <p>You were away for {returnReward.minutes} minutes.</p>
          <p className="text-2xl font-bold">+{returnReward.xp} XP</p>
          <button onClick={dismissReturnReward} className="mt-2 text-sm underline">
            Dismiss
          </button>
        </div>
      )}

      {questMessage && (
        <div className="bg-green-600 p-4 rounded-lg mb-4 text-center">
          <p className="font-bold">{questMessage}</p>
          <button onClick={dismissQuestMessage} className="mt-2 text-sm underline">
            Dismiss
          </button>
        </div>
      )}

      <div className="max-w-md mx-auto space-y-6">
        <div className="bg-slate-700 rounded-xl p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xl font-bold">Level {gameState.player.level}</span>
            <span className="text-gray-300">{gameState.player.xp} XP</span>
          </div>
          <div className="bg-slate-600 rounded-full h-4 overflow-hidden">
            <div
              className="bg-gradient-to-r from-green-400 to-green-600 h-full transition-all"
              style={{
                width: `${((gameState.player.xp % 100) / 100) * 100}%`,
              }}
            />
          </div>
          <p className="text-sm text-gray-400 mt-1">
            Next: {getXpForNextLevel(gameState.player.level)} XP
          </p>
        </div>

        <div className="bg-slate-700 rounded-xl p-4">
          <h2 className="text-lg font-bold mb-2">World State</h2>
          <div className="flex items-center gap-4">
            <div
              className={`text-2xl ${
                gameState.world.state === 'stable'
                  ? 'text-green-400'
                  : gameState.world.state === 'warning'
                  ? 'text-yellow-400'
                  : 'text-red-400'
              }`}
            >
              {gameState.world.state === 'stable'
                ? '🌱'
                : gameState.world.state === 'warning'
                ? '⚠️'
                : '💀'}
            </div>
            <div className="flex-1">
              <div className="flex justify-between mb-1">
                <span className="capitalize">{gameState.world.state}</span>
                <span>{gameState.world.corruption}%</span>
              </div>
              <div className="bg-slate-600 rounded-full h-3 overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    gameState.world.corruption < 50
                      ? 'bg-green-500'
                      : gameState.world.corruption < 80
                      ? 'bg-yellow-500'
                      : 'bg-red-500'
                  }`}
                  style={{ width: `${gameState.world.corruption}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-slate-700 rounded-xl p-4">
          <h2 className="text-lg font-bold mb-2">Current Quest</h2>
          {gameState.currentQuest ? (
            <div>
              <p className="mb-2">{gameState.currentQuest.description}</p>
              {gameState.currentQuest.type === 'travel' && (
                <div className="mb-2">
                  <div className="bg-slate-600 rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-blue-500 h-full transition-all"
                      style={{
                        width: `${Math.min(100, (gameState.currentQuest.progress / gameState.currentQuest.goal) * 100)}%`,
                      }}
                    />
                  </div>
                  <p className="text-sm text-gray-400 mt-1">
                    {Math.round(gameState.currentQuest.progress)}m / {gameState.currentQuest.goal}m
                  </p>
                </div>
              )}
              {gameState.currentQuest.type === 'photo' && (
                <CameraCapture onCapture={handlePhotoCapture} />
              )}
              {gameState.currentQuest.type === 'wait' && (
                <p className="text-sm text-gray-400">Complete this quest by returning after 5+ minutes</p>
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
            <p className="text-gray-400">No active quest</p>
          )}
        </div>

        <div className="bg-slate-700 rounded-xl p-4">
          <h2 className="text-lg font-bold mb-2">Location</h2>
          {isLoading ? (
            <p className="text-gray-400">Getting location...</p>
          ) : error ? (
            <p className="text-red-400">{error}</p>
          ) : location ? (
            <div>
              <p className="text-sm">
                {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
              </p>
              {distanceFromLast !== null && (
                <p className="text-sm text-gray-400 mt-1">
                  {distanceFromLast > 100 ? '✅' : '📍'} {Math.round(distanceFromLast)}m from last location
                </p>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}