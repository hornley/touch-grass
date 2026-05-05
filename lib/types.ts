export interface Location {
  lat: number;
  lng: number;
  timestamp: number;
}

export interface Player {
  xp: number;
  level: number;
  lastLocation: Location | null;
  lastActive: number;
  completedQuests: string[];
}

export type QuestType = 'travel' | 'photo' | 'wait' | 'meditate' | 'object';

export interface Quest {
  id: string;
  type: QuestType;
  status: 'active' | 'completed';
  progress: number;
  goal: number;
  xpReward: number;
  description: string;
  targetObject?: string;
}

export type WorldState = 'stable' | 'warning' | 'corrupted';

export interface World {
  corruption: number;
  state: WorldState;
}

export interface GameState {
  player: Player;
  currentQuest: Quest | null;
  world: World;
  lastAway: number | null;
}