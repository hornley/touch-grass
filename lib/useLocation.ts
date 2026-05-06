'use client';
import { useState, useCallback, useEffect, useRef } from 'react';
import { Location } from './types';
import { createSlidingWindowTracker, MotionState } from './slidingWindowTracker';

interface DebugInfo {
  windowDistance: number;
  rawDelta: number;
  smoothedDelta: number;
  clampedDelta: number;
  pointCount: number;
  windowDuration: number;
  isValid: boolean;
  gpsSpeed: number;
  recentSpeed: number;
  stableState: MotionState;
}

interface UseLocationResult {
  location: Location | null;
  error: string | null;
  isLoading: boolean;
  requestLocation: () => Promise<void>;
  startTracking: () => void;
  stopTracking: () => void;
  isTracking: boolean;
  cumulativeDistance: number;
  lastMovementDistance: number;
  currentAccuracy: number | null;
  currentSpeed: number | null;
  currentSegmentDist: number | null;
  motionState: MotionState | null;
  debugInfo: DebugInfo;
}

const MIN_ACCURACY = 150;

function getMultiplier(state: MotionState): number {
  switch (state) {
    case 'walking':
      return 1.0;
    case 'movingFast':
      return 0.3;
    case 'idle':
    default:
      return 0;
  }
}

export function useLocation(lastLocation: Location | null, enabled: boolean = false): UseLocationResult {
  const [location, setLocation] = useState<Location | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  const [cumulativeDistance, setCumulativeDistance] = useState(0);
  const [lastMovementDistance, setLastMovementDistance] = useState(0);
  const [currentAccuracy, setCurrentAccuracy] = useState<number | null>(null);
  const [currentSpeed, setCurrentSpeed] = useState<number | null>(null);
  const [currentSegmentDist, setCurrentSegmentDist] = useState<number | null>(null);
  const [motionState, setMotionState] = useState<MotionState | null>(null);

  const [debugInfo, setDebugInfo] = useState<DebugInfo>({
    windowDistance: 0,
    rawDelta: 0,
    smoothedDelta: 0,
    clampedDelta: 0,
    pointCount: 0,
    windowDuration: 0,
    isValid: false,
    gpsSpeed: 0,
    recentSpeed: 0,
    stableState: 'idle',
  });

  const slidingWindowRef = useRef(createSlidingWindowTracker());
  const intervalRef = useRef<number | null>(null);

  const processLocation = useCallback((
    lat: number,
    lng: number,
    accuracy: number,
    timestamp: number
  ) => {
    slidingWindowRef.current.addPosition(lat, lng, accuracy, timestamp);

    const metrics = slidingWindowRef.current.getMetrics();
    const clampedDelta = metrics.clampedDelta;

    const multiplier = getMultiplier(metrics.stableState);
    const progressDelta = clampedDelta * multiplier;

    setMotionState(metrics.stableState);
    setDebugInfo({
      windowDistance: metrics.windowDistance,
      rawDelta: metrics.rawDelta,
      smoothedDelta: metrics.smoothedDelta,
      clampedDelta: metrics.clampedDelta,
      pointCount: metrics.pointCount,
      windowDuration: metrics.windowDuration,
      isValid: metrics.isValid,
      gpsSpeed: metrics.gpsSpeed,
      recentSpeed: metrics.recentSpeed,
      stableState: metrics.stableState,
    });

    if (metrics.isValid && progressDelta > 0) {
      setLastMovementDistance(progressDelta);
      setCurrentSegmentDist(progressDelta);
      setCurrentSpeed(metrics.gpsSpeed);
      if (isTracking) {
        setCumulativeDistance(prev => prev + progressDelta);
      }
    } else {
      setLastMovementDistance(0);
      setCurrentSegmentDist(null);
      setCurrentSpeed(metrics.gpsSpeed > 0 ? metrics.gpsSpeed : null);
    }

    setCurrentAccuracy(accuracy);

    setLocation({
      lat,
      lng,
      timestamp,
    });
  }, [isTracking]);

  const requestLocation = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const params = new URLSearchParams(window.location.search);
    const simLat = params.get('lat');
    const simLng = params.get('lng');

    if (simLat && simLng) {
      processLocation(parseFloat(simLat), parseFloat(simLng), 5, Date.now());
      setIsLoading(false);
      return;
    }

    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      setIsLoading(false);
      return;
    }

    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        });
      });

      const accuracy = pos.coords.accuracy;

      if (accuracy > MIN_ACCURACY) {
        setCurrentAccuracy(accuracy);
        setError(`Accuracy too poor: ${accuracy.toFixed(0)}m`);
        setIsLoading(false);
        return;
      }

      processLocation(pos.coords.latitude, pos.coords.longitude, accuracy, Date.now());
    } catch (err) {
      const ge = err as GeolocationPositionError;
      if (ge.code === ge.PERMISSION_DENIED) {
        setError('Location permission denied. Please enable location access.');
      } else if (ge.code === ge.POSITION_UNAVAILABLE) {
        setError('Location information unavailable.');
      } else if (ge.code === ge.TIMEOUT) {
        setError('Location request timed out.');
      } else {
        setError('Failed to get location.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [processLocation]);

  const startTracking = useCallback(() => {
    setIsTracking(true);
    if (!location) {
      void requestLocation();
    }
  }, [location, requestLocation]);

  const stopTracking = useCallback(() => {
    setIsTracking(false);
  }, []);

  const fetchLocation = useCallback(async () => {
    const params = new URLSearchParams(window.location.search);
    const simLat = params.get('lat');
    const simLng = params.get('lng');

    if (simLat && simLng) {
      processLocation(parseFloat(simLat), parseFloat(simLng), 5, Date.now());
      return;
    }

    if (!navigator.geolocation) return;

    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        });
      });

      const accuracy = pos.coords.accuracy;

      if (accuracy > MIN_ACCURACY) {
        setCurrentAccuracy(accuracy);
        return;
      }

      processLocation(pos.coords.latitude, pos.coords.longitude, accuracy, Date.now());
    } catch {
    }
  }, [processLocation]);

  useEffect(() => {
    if (enabled && !location) {
      requestLocation();
    }
  }, [enabled, location, requestLocation]);

  useEffect(() => {
    if (enabled && isTracking && location) {
      intervalRef.current = window.setInterval(fetchLocation, 5000);
    }

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, isTracking, location, fetchLocation]);

  useEffect(() => {
    if (!enabled) {
      setIsTracking(false);
    }
  }, [enabled]);

  return {
    location,
    error,
    isLoading,
    requestLocation,
    startTracking,
    stopTracking,
    isTracking,
    cumulativeDistance,
    lastMovementDistance,
    currentAccuracy,
    currentSpeed,
    currentSegmentDist,
    motionState,
    debugInfo,
  };
}