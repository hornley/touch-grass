const SESSION_KEY = 'terraquest_session';
const MAX_RESUME_MS = 60 * 60 * 1000;  // 60 minutes - max time to resume from

export interface SessionState {
  lastActiveTimestamp: number;
  sessionStartTimestamp: number;
  totalProgress: number;
  questProgress: number;
  questId: string | null;
  questGoal: number;
  lastLat: number | null;
  lastLng: number | null;
}

export interface SessionResult {
  isNewSession: boolean;
  timeAwayMs: number;
  sessionData: SessionState | null;
  canResume: boolean;
}

export function saveSession(
  totalProgress: number,
  questProgress: number,
  questId: string | null,
  questGoal: number,
  lastLat: number | null,
  lastLng: number | null
): void {
  const session: SessionState = {
    lastActiveTimestamp: Date.now(),
    sessionStartTimestamp: Date.now(),
    totalProgress,
    questProgress,
    questId,
    questGoal,
    lastLat,
    lastLng,
  };
  
  if (typeof window !== 'undefined') {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }
}

export function loadSession(): SessionResult {
  if (typeof window === 'undefined') {
    return { isNewSession: true, timeAwayMs: 0, sessionData: null, canResume: false };
  }

  const stored = localStorage.getItem(SESSION_KEY);
  
  if (!stored) {
    return { isNewSession: true, timeAwayMs: 0, sessionData: null, canResume: false };
  }

  try {
    const sessionData: SessionState = JSON.parse(stored);
    const now = Date.now();
    const timeAwayMs = now - sessionData.lastActiveTimestamp;

    // Resume if within max time window (60 minutes)
    // This handles: phone restart, force close, browser crash
    const canResume = timeAwayMs <= MAX_RESUME_MS;

    // If can resume OR has valid saved progress
    if (canResume || sessionData.totalProgress > 0 || sessionData.questProgress > 0) {
      return {
        isNewSession: false,
        timeAwayMs,
        sessionData,
        canResume
      };
    }

    // No progress saved, start fresh
    return { isNewSession: true, timeAwayMs, sessionData: null, canResume: false };
  } catch {
    return { isNewSession: true, timeAwayMs: 0, sessionData: null, canResume: false };
  }
}

export function clearSession(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(SESSION_KEY);
  }
}

export function getTimeAwayBonus(timeAwayMs: number): number {
  // Return bonus XP - anytime they come back with saved progress
  if (timeAwayMs < 60000) return 0;  // Less than 1 minute - no bonus needed
  
  const minutes = Math.floor(timeAwayMs / 60000);
  
  if (minutes <= 2) return 5;
  if (minutes <= 5) return 10;
  if (minutes <= 10) return 15;
  if (minutes <= 30) return 20;
  
  return 25;
}

export function shouldSaveSession(lastActiveTimestamp: number): boolean {
  return Date.now() - lastActiveTimestamp > 60000;
}