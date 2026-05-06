export interface LocationPoint {
  lat: number;
  lng: number;
  timestamp: number;
  accuracy: number;
}

export interface SlidingWindowConfig {
  windowMs: number;
  minAccuracy: number;
  maxJumpMeters: number;
  minBufferPoints: number;
  idleThreshold: number;
  walkingThreshold: number;
  maxReasonableSpeed: number;
}

export const DEFAULT_CONFIG: SlidingWindowConfig = {
  windowMs: 60000,
  minAccuracy: 50,
  maxJumpMeters: 15,
  minBufferPoints: 10,
  idleThreshold: 0.5,
  walkingThreshold: 2.0,
  maxReasonableSpeed: 2.5,
};

export class LocationBuffer {
  private points: LocationPoint[] = [];
  private config: SlidingWindowConfig;

  constructor(config: Partial<SlidingWindowConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  addPoint(point: LocationPoint): boolean {
    if (point.accuracy > this.config.minAccuracy) {
      return false;
    }

    if (this.points.length > 0) {
      const last = this.points[this.points.length - 1];
      const timeDiff = (point.timestamp - last.timestamp) / 1000;
      
      if (timeDiff > 0) {
        const dist = this.haversine(last.lat, last.lng, point.lat, point.lng);
        const speed = dist / timeDiff;
        
        if (speed > this.config.maxReasonableSpeed) {
          return false;
        }

        if (dist > this.config.maxJumpMeters) {
          this.points = [];
        }
      }
    }

    this.points.push(point);
    this.prune();
    return true;
  }

  prune(): void {
    const now = Date.now();
    this.points = this.points.filter(
      p => now - p.timestamp <= this.config.windowMs
    );
  }

  getPoints(): LocationPoint[] {
    return [...this.points];
  }

  getWindowDuration(): number {
    const points = this.points;
    if (points.length < 2) return 0;
    const oldest = Math.min(...points.map(p => p.timestamp));
    const newest = Math.max(...points.map(p => p.timestamp));
    return newest - oldest;
  }

  hasEnoughData(): boolean {
    return this.points.length >= this.config.minBufferPoints;
  }

  clear(): void {
    this.points = [];
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