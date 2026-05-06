import { LocationPoint } from './locationBuffer';
import { SlidingWindowConfig, DEFAULT_CONFIG } from './locationBuffer';

export type MotionState = 'idle' | 'walking' | 'movingFast';

export interface MovementMetrics {
  distance: number;
  speed: number;
  motionState: MotionState;
  windowDuration: number;
  isValid: boolean;
  pointsCount: number;
}

export class MovementAnalyzer {
  private config: SlidingWindowConfig;

  constructor(config: Partial<SlidingWindowConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  analyze(points: LocationPoint[]): MovementMetrics {
    if (points.length < 2) {
      return this.emptyMetrics();
    }

    const windowDuration = this.getWindowDuration(points);
    if (windowDuration < 10000) {
      return this.emptyMetrics();
    }

    const distance = this.calculateWindowDistance(points);
    const speed = windowDuration > 0 ? distance / (windowDuration / 1000) : 0;

    if (speed > this.config.maxReasonableSpeed || speed < 0) {
      return this.emptyMetrics();
    }

    const motionState = this.deriveMotionState(speed);

    return {
      distance,
      speed,
      motionState,
      windowDuration,
      isValid: true,
      pointsCount: points.length,
    };
  }

  getMotionMultiplier(state: MotionState): number {
    switch (state) {
      case 'walking':
        return 1.0;
      case 'movingFast':
        return 0.25;
      case 'idle':
        return 0;
    }
  }

  private filterPoints(points: LocationPoint[]): LocationPoint[] {
    if (points.length < 2) return [];

    const filtered: LocationPoint[] = [points[0]];
    for (let i = 1; i < points.length; i++) {
      if (points[i].accuracy > this.config.minAccuracy) continue;

      const prev = filtered[filtered.length - 1];
      const dist = this.haversine(
        prev.lat, prev.lng,
        points[i].lat, points[i].lng
      );

      if (dist > this.config.maxJumpMeters) {
        filtered.length = 0;
        filtered.push(points[i]);
        continue;
      }

      filtered.push(points[i]);
    }

    return filtered;
  }

  private calculateWindowDistance(points: LocationPoint[]): number {
    let total = 0;
    for (let i = 1; i < points.length; i++) {
      total += this.haversine(
        points[i - 1].lat, points[i - 1].lng,
        points[i].lat, points[i].lng
      );
    }
    return total;
  }

  private deriveMotionState(speed: number): MotionState {
    if (speed < this.config.idleThreshold) return 'idle';
    if (speed < this.config.walkingThreshold) return 'walking';
    return 'movingFast';
  }

  private getWindowDuration(points: LocationPoint[]): number {
    if (points.length < 2) return 0;
    const oldest = Math.min(...points.map(p => p.timestamp));
    const newest = Math.max(...points.map(p => p.timestamp));
    return newest - oldest;
  }

  private emptyMetrics(): MovementMetrics {
    return {
      distance: 0,
      speed: 0,
      motionState: 'idle',
      windowDuration: 0,
      isValid: false,
      pointsCount: 0,
    };
  }

  private haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
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
}