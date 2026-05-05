import { GameState, Quest, World, WorldState } from './types';

const STORAGE_KEY = 'terraquest_state';

export const ACHIEVEMENTS = [
  { id: 'first_quest',     name: 'First Steps',  icon: '🌱', description: 'Complete your first quest' },
  { id: 'photographer_3',  name: 'Shutter Bug',  icon: '📸', description: 'Complete 3 photo quests' },
  { id: 'photographer_10', name: 'Lens Master',  icon: '🎞️', description: 'Complete 10 photo quests' },
  { id: 'explorer_500m',   name: 'Pathfinder',   icon: '🚶', description: 'Walk 500 meters total' },
  { id: 'explorer_1km',    name: 'Wanderer',     icon: '🗺️', description: 'Walk 1 kilometer total' },
  { id: 'streak_3',        name: 'Committed',    icon: '🔥', description: '3-day streak' },
  { id: 'streak_7',        name: 'Dedicated',    icon: '⚡', description: '7-day streak' },
  { id: 'level_5',         name: 'Veteran',      icon: '⭐', description: 'Reach level 5' },
  { id: 'guardian',        name: 'Guardian',     icon: '🛡️', description: 'Reduce world corruption to 0%' },
];

export const QUEST_POOL: Omit<Quest, 'status' | 'progress'>[] = [
  { id: 'quest_5', type: 'travel', goal: 100,  xpReward: 20, description: 'Walk 100 meters to explore new territory' },
  { id: 'quest_7', type: 'travel', goal: 1000, xpReward: 50, description: 'Walk 1 kilometer — a true explorer', minLevel: 5 },
  { id: 'quest_8', type: 'meditate', goal: 30, xpReward: 25, description: 'Meditate for 30 seconds' },
  { id: 'quest_9', type: 'meditate', goal: 30, xpReward: 30, description: 'Clear your mind for 30 seconds' },
  { id: 'quest_10', type: 'object', goal: 1, xpReward: 20, description: 'Find a tree or plant', targetObject: 'tree' },
  { id: 'quest_11', type: 'object', goal: 1, xpReward: 20, description: 'Find a cup or bottle', targetObject: 'cup' },
  { id: 'quest_12', type: 'object', goal: 1, xpReward: 20, description: 'Find a book', targetObject: 'book' },
  { id: 'quest_14', type: 'object', goal: 1, xpReward: 25, description: 'Find a person', targetObject: 'person' },
  { id: 'quest_15', type: 'object', goal: 1, xpReward: 25, description: 'Find a cat or dog', targetObject: 'cat' },
];

export function getInitialState(): GameState {
  return {
    player: {
      xp: 0,
      level: 1,
      lastLocation: null,
      lastActive: Date.now(),
      completedQuests: [],
      streak: 0,
      lastStreakDate: null,
      totalDistance: 0,
      achievements: [],
      photoQuestsCompleted: 0,
    },
    currentQuest: null,
    world: {
      corruption: 0,
      state: 'stable',
    },
    lastAway: null,
    sessions: [],
    currentSession: null,
  };
}

export function loadGameState(): GameState {
  if (typeof window === 'undefined') return getInitialState();
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return getInitialState();
  try {
    return JSON.parse(stored);
  } catch {
    return getInitialState();
  }
}

export function saveGameState(state: GameState): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function calculateLevel(xp: number): number {
  return Math.floor(Math.sqrt(xp / 100)) + 1;
}

export function getXpForNextLevel(level: number): number {
  return Math.pow(level, 2) * 100;
}

export function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function getQuestXpMultiplier(level: number): number {
  if (level >= 7) return 1.5;
  if (level >= 3) return 1.2;
  return 1.0;
}

export function getRandomQuest(completedIds: string[], level: number = 1): Quest {
  const available = QUEST_POOL.filter(q => !completedIds.includes(q.id) && (q.minLevel ?? 1) <= level);
  const pool = available.length > 0 ? available : QUEST_POOL.filter(q => (q.minLevel ?? 1) <= level);
  const selected = pool[Math.floor(Math.random() * pool.length)];
  return {
    ...selected,
    status: 'active',
    progress: 0,
  };
}

export function updateStreak(
  lastStreakDate: string | null,
  currentStreak: number,
): { streak: number; lastStreakDate: string } {
  const today = new Date().toISOString().slice(0, 10);
  if (lastStreakDate === today) {
    return { streak: currentStreak, lastStreakDate: today };
  }
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (lastStreakDate === yesterday) {
    return { streak: currentStreak + 1, lastStreakDate: today };
  }
  return { streak: 1, lastStreakDate: today };
}

export function checkNewAchievements(state: GameState): string[] {
  const { player, world } = state;
  const already = new Set(player.achievements);
  const unlocked: string[] = [];

  const check = (id: string, condition: boolean) => {
    if (!already.has(id) && condition) unlocked.push(id);
  };

  check('first_quest',     player.completedQuests.length >= 1);
  check('photographer_3',  player.photoQuestsCompleted >= 3);
  check('photographer_10', player.photoQuestsCompleted >= 10);
  check('explorer_500m',   player.totalDistance >= 500);
  check('explorer_1km',    player.totalDistance >= 1000);
  check('streak_3',        player.streak >= 3);
  check('streak_7',        player.streak >= 7);
  check('level_5',         player.level >= 5);
  check('guardian',        world.corruption === 0);

  return unlocked;
}

export function updateWorldState(lastActive: number, current: World): World {
  const now = Date.now();
  const diffMinutes = (now - lastActive) / 60000;
  if (diffMinutes < 5) return current;
  const corruptionIncrease = Math.floor(diffMinutes / 5) * 10;
  const newCorruption = Math.min(100, current.corruption + corruptionIncrease);
  let state: WorldState = 'stable';
  if (newCorruption >= 80) state = 'corrupted';
  else if (newCorruption >= 50) state = 'warning';
  return { corruption: newCorruption, state };
}

export function reduceCorruption(world: World): World {
  const newCorruption = Math.max(0, world.corruption - 10);
  let state: WorldState = 'stable';
  if (newCorruption >= 80) state = 'corrupted';
  else if (newCorruption >= 50) state = 'warning';
  return { corruption: newCorruption, state };
}

export function calculateReturnReward(lastAway: number | null): { minutes: number; xp: number } {
  if (!lastAway) return { minutes: 0, xp: 0 };
  const diffMs = Date.now() - lastAway;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 2) return { minutes: 0, xp: 0 };
  const baseMinutes = Math.min(minutes, 60);
  const overtime = Math.max(0, minutes - 60);
  const xp = baseMinutes + overtime * 2;
  return { minutes, xp };
}