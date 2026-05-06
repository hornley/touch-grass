export type MotionState = 'idle' | 'walking' | 'movingFast';

export interface SlidingWindowMetrics {
  windowDistance: number;
  rawDelta: number;
  smoothedDelta: number;
  clampedDelta: number;
  pointCount: number;
  windowDuration: number;
  isValid: boolean;
  movementState: MotionState;
  gpsSpeed: number;
  recentSpeed: number;
  recentState: MotionState;
  stableState: MotionState;
}

export interface SlidingWindowTracker {
  addPosition: (lat: number, lng: number, accuracy: number, timestamp?: number) => boolean;
  getMetrics: () => SlidingWindowMetrics;
  getProgressDelta: () => number;
  reset: () => void;
}

let lastWindowDistance = 0;
let lastSmoothedDelta = 0;

// Hysteresis state machine
let hysteresisState: MotionState = 'idle';
const movementHistory: boolean[] = [false, false, false]; // Last 3 ticks

const ALPHA = 0.35;
const MAX_DELTA = 10;
const EPSILON = 0.2;
const WINDOW_MS = 45000;
const RECENT_WINDOW_MS = 8000;
const WALKING_SPEED_THRESHOLD = 0.3;

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function computeSpeed(distance: number, durationMs: number): number {
  if (durationMs <= 0) return 0;
  return distance / (durationMs / 1000);
}

function deriveMotionState(speed: number): MotionState {
  if (speed >= 2.5) return 'movingFast';
  if (speed >= 0.2) return 'walking';
  return 'idle';
}

export function createSlidingWindowTracker(): SlidingWindowTracker {
  const buffer: Array<{ lat: number; lng: number; timestamp: number; accuracy: number }> = [];

  function addPosition(lat: number, lng: number, accuracy: number, timestamp?: number): boolean {
    buffer.push({
      lat,
      lng,
      accuracy,
      timestamp: timestamp ?? Date.now(),
    });

    const cutoff = Date.now() - WINDOW_MS;
    while (buffer.length && buffer[0].timestamp < cutoff) {
      buffer.shift();
    }

    return true;
  }

  function getValidPoints(): Array<{ lat: number; lng: number; timestamp: number; accuracy: number }> {
    if (buffer.length < 2) return [];

    const valid: Array<{ lat: number; lng: number; timestamp: number; accuracy: number }> = [];
    valid.push(buffer[0]);

    for (let i = 1; i < buffer.length; i++) {
      if (buffer[i].accuracy > 50) continue;
      if (buffer[i - 1].accuracy > 50) continue;

      const prev = valid[valid.length - 1];
      const dist = haversine(prev.lat, prev.lng, buffer[i].lat, buffer[i].lng);

      if (dist > 40) {
        valid.length = 0;
        valid.push(buffer[i]);
        continue;
      }

      valid.push(buffer[i]);
    }

    return valid;
  }

  function computeRecentMetrics(validPoints: Array<{ lat: number; lng: number; timestamp: number; accuracy: number }>) {
    // Get only recent points (last 8 seconds) for state detection
    const now = Date.now();
    const recentPoints = validPoints.filter(p => now - p.timestamp <= RECENT_WINDOW_MS);
    
    if (recentPoints.length < 2) {
      return { recentSpeed: 0, recentState: 'idle' as MotionState };
    }
    
    const recentDuration = recentPoints[recentPoints.length - 1].timestamp - recentPoints[0].timestamp;
    if (recentDuration < 3000) { // Less than 3 seconds of recent data
      return { recentSpeed: 0, recentState: 'idle' as MotionState };
    }
    
    let recentDistance = 0;
    for (let i = 1; i < recentPoints.length; i++) {
      recentDistance += haversine(
        recentPoints[i - 1].lat,
        recentPoints[i - 1].lng,
        recentPoints[i].lat,
        recentPoints[i].lng
      );
    }
    
    const recentSpeed = computeSpeed(recentDistance, recentDuration);
    const recentState = deriveMotionState(recentSpeed);
    
    return { recentSpeed, recentState };
  }

  function getMetrics(): SlidingWindowMetrics {
    const validPoints = getValidPoints();
    const windowDuration = validPoints.length >= 2
      ? validPoints[validPoints.length - 1].timestamp - validPoints[0].timestamp
      : 0;

    let windowDistance = 0;
    if (validPoints.length >= 2) {
      for (let i = 1; i < validPoints.length; i++) {
        windowDistance += haversine(
          validPoints[i - 1].lat,
          validPoints[i - 1].lng,
          validPoints[i].lat,
          validPoints[i].lng
        );
      }
    }

    const gpsSpeed = windowDuration > 0 ? computeSpeed(windowDistance, windowDuration) : 0;

    // Get recent metrics for responsive state
    const { recentSpeed, recentState } = computeRecentMetrics(validPoints);

    // Update movement history (last 3 ticks) - for hysteresis
    const isMovingNow = recentSpeed >= WALKING_SPEED_THRESHOLD;
    movementHistory.push(isMovingNow);
    if (movementHistory.length > 3) movementHistory.shift();
    const walkingCount = movementHistory.filter(Boolean).length;
    const idleCount = 3 - walkingCount;

    // Apply hysteresis state machine
    if (hysteresisState === 'idle') {
      // Need 2 of 3 ticks moving to enter walking
      if (walkingCount >= 2) hysteresisState = 'walking';
    } else {
      // Need 2 of 3 ticks idle to exit walking (stricter exit)
      if (idleCount >= 2) hysteresisState = 'idle';
    }

    const stableState = hysteresisState;

if (validPoints.length < 2) {
      return {
        windowDistance: 0,
        rawDelta: 0,
        smoothedDelta: 0,
        clampedDelta: 0,
        pointCount: validPoints.length,
        windowDuration,
        isValid: false,
        movementState: recentState,
        gpsSpeed: 0,
        recentSpeed: 0,
        recentState: 'idle',
        stableState: 'idle', // Force idle when not enough data
      };
    }

    const rawDelta = windowDistance - lastWindowDistance;

    if (Math.abs(rawDelta) < EPSILON) {
      lastWindowDistance = windowDistance;
      return {
        windowDistance,
        rawDelta: 0,
        smoothedDelta: lastSmoothedDelta,
        clampedDelta: 0,
        pointCount: validPoints.length,
        windowDuration,
        isValid: validPoints.length >= 3 && windowDuration >= 8000,
        movementState: recentState,
        gpsSpeed,
        recentSpeed,
        recentState,
        stableState,
      };
    }

    const smoothedDelta = ALPHA * rawDelta + (1 - ALPHA) * lastSmoothedDelta;
    const clampedDelta = Math.max(0, Math.min(MAX_DELTA, smoothedDelta));

    lastWindowDistance = windowDistance;
    lastSmoothedDelta = smoothedDelta;

    return {
      windowDistance,
      rawDelta,
      smoothedDelta,
      clampedDelta,
      pointCount: validPoints.length,
      windowDuration,
      isValid: validPoints.length >= 3 && windowDuration >= 8000,
      movementState: recentState,
      gpsSpeed,
      recentSpeed,
      recentState,
      stableState,
    };
  }

  function getProgressDelta(): number {
    return getMetrics().clampedDelta;
  }

  function reset(): void {
    buffer.length = 0;
    lastWindowDistance = 0;
    lastSmoothedDelta = 0;
  }

  return {
    addPosition,
    getMetrics,
    getProgressDelta,
    reset,
  };
}