import { GameState, Quest, World, WorldState } from './types';

const STORAGE_KEY = 'terraquest_state';

export const QUEST_POOL: Omit<Quest, 'status' | 'progress'>[] = [
  { id: 'quest_1', type: 'meditate', goal: 30, xpReward: 25, description: 'Meditate for 30 seconds' },
  { id: 'quest_2', type: 'meditate', goal: 30, xpReward: 30, description: 'Clear your mind for 30 seconds' },
  { id: 'quest_3', type: 'object', goal: 1, xpReward: 20, description: 'Find a tree or plant', targetObject: 'tree' },
  { id: 'quest_4', type: 'object', goal: 1, xpReward: 20, description: 'Find a cup or bottle', targetObject: 'cup' },
  { id: 'quest_5', type: 'object', goal: 1, xpReward: 20, description: 'Find a book', targetObject: 'book' },
  { id: 'quest_6', type: 'object', goal: 1, xpReward: 20, description: 'Find a phone', targetObject: 'phone' },
  { id: 'quest_7', type: 'object', goal: 1, xpReward: 25, description: 'Find a person', targetObject: 'person' },
  { id: 'quest_8', type: 'object', goal: 1, xpReward: 25, description: 'Find a cat or dog', targetObject: 'cat' },
  { id: 'quest_9', type: 'photo', goal: 1, xpReward: 15, description: 'Take a photo to collect energy' },
  { id: 'quest_10', type: 'travel', goal: 100, xpReward: 20, description: 'Walk 100 meters to explore new territory' },
];

export function getInitialState(): GameState {
  return {
    player: {
      xp: 0,
      level: 1,
      lastLocation: null,
      lastActive: Date.now(),
      completedQuests: [],
    },
    currentQuest: null,
    world: {
      corruption: 0,
      state: 'stable',
    },
    lastAway: null,
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

export function getRandomQuest(completedIds: string[]): Quest {
  const available = QUEST_POOL.filter(q => !completedIds.includes(q.id));
  const pool = available.length > 0 ? available : QUEST_POOL;
  const selected = pool[Math.floor(Math.random() * pool.length)];
  return {
    ...selected,
    status: 'active',
    progress: 0,
  };
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