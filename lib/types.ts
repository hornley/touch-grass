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
}

export interface Quest {
  id: string;
  type: 'travel' | 'photo' | 'wait' | 'meditate' | 'object';
  status: 'active' | 'completed';
  progress: number;
  goal: number;
  xpReward: number;
  description: string;
  minLevel?: number;
  targetObject?: string;
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
  lastAway: number | null;
  sessions: Session[];
  currentSession: CurrentSession | null;
}