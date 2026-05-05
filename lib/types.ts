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
  streak: number;
  lastStreakDate: string | null;
  totalDistance: number;
  achievements: string[];
  photoQuestsCompleted: number;
  currentChain: ChainState | null;
  chainCompletions: number;
}

export interface Quest {
  id: string;
  type: 'travel' | 'photo' | 'wait' | 'meditate' | 'object' | 'visit';
  status: 'active' | 'completed';
  progress: number;
  goal: number;
  xpReward: number;
  description: string;
  minLevel?: number;
  targetObject?: string;
  targetName?: string;
  targetLat?: number;
  targetLng?: number;
  radiusM?: number;
  isCryptic?: boolean;
}

export interface ChainState {
  id: string;
  stepIndex: number;
  totalSteps: number;
  type: 'fixed' | 'dynamic';
  multiplier: number;
  xpEarned: number;
}

export type WorldState = 'stable' | 'warning' | 'corrupted';

export interface World {
  corruption: number;
  state: WorldState;
}

export interface Session {
  startTime: number;
  endTime: number;
  xpEarned: number;
  questsCompleted: number;
}

export interface CurrentSession {
  startTime: number;
  xpEarned: number;
  questsCompleted: number;
}

export interface GameState {
  player: Player;
  currentQuest: Quest | null;
  world: World;
  lastAway: number | null;
  sessions: Session[];
  currentSession: CurrentSession | null;
}
