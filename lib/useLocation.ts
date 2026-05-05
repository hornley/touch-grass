'use client';
import { useState, useCallback, useEffect, useRef } from 'react';
import { Location } from './types';
import { calculateDistance } from './game';

interface Position {
  lat: number;
  lng: number;
  timestamp: number;
  accuracy: number;
}

interface UseLocationResult {
  location: Location | null;
  error: string | null;
  isLoading: boolean;
  isTracking: boolean;
  requestLocation: () => Promise<void>;
  startTracking: () => void;
  stopTracking: () => void;
  cumulativeDistance: number;
  lastMovementDistance: number;
  currentAccuracy: number | null;
  currentSpeed: number | null;
  currentSegmentDist: number | null;
}

// Mobile browsers often report 30-100m accuracy, especially at cold start.
// Keep this fairly permissive, and rely on MIN_MOVEMENT + MAX_SPEED_MPS to
// filter jitter and vehicle-speed jumps.
const MIN_ACCURACY = 100;
// Lowered from 5m - GPS updates frequently so we can use smaller increments.
// 1m lets even short steps count while still filtering noise.
const MIN_MOVEMENT = 1;
const MAX_SPEED_MPS = 10;

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

  const watchIdRef = useRef<number | null>(null);
  const lastProcessedRef = useRef<{ lat: number; lng: number; time: number; accuracy: number } | null>(null);

  const requestLocation = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const params = new URLSearchParams(window.location.search);
    const simLat = params.get('lat');
    const simLng = params.get('lng');

    if (simLat && simLng) {
      const simulatedLocation: Location = {
        lat: parseFloat(simLat),
        lng: parseFloat(simLng),
        timestamp: Date.now(),
      };
      setLocation(simulatedLocation);
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
           maximumAge: 300000,
         });
       });

      const newLocation: Location = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        timestamp: Date.now(),
      };
      setLocation(newLocation);
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
  }, []);

  const startTracking = useCallback(() => {
    if (isTracking || !navigator.geolocation) return;

    setIsTracking(true);
    setCumulativeDistance(0);
    setLastMovementDistance(0);
    lastProcessedRef.current = null;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const accuracy = pos.coords.accuracy;

        const newPos: Position = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          timestamp: Date.now(),
          accuracy,
        };

        // Default: avoid reusing a previous non-zero movement value.
        setLastMovementDistance(0);
        setCurrentSpeed(null);
        setCurrentSegmentDist(null);

        if (lastProcessedRef.current) {
          const timeDiff = (newPos.timestamp - lastProcessedRef.current.time) / 1000;
          if (timeDiff > 0) {
            const segmentDist = calculateDistance(
              lastProcessedRef.current.lat, lastProcessedRef.current.lng,
              newPos.lat, newPos.lng
            );

            const speedMps = segmentDist / timeDiff;
            // Only check current accuracy - previous reading being slightly off is okay
            // since we're measuring distance between two points.
            const accurateEnough = newPos.accuracy <= MIN_ACCURACY;

            // Always set debug values so we can see what's happening
            setCurrentSegmentDist(segmentDist);
            setCurrentSpeed(speedMps);

            if (accurateEnough && speedMps <= MAX_SPEED_MPS && segmentDist >= MIN_MOVEMENT) {
              setCumulativeDistance((prevDist) => prevDist + segmentDist);
              setLastMovementDistance(segmentDist);
            }
          }
        }

        lastProcessedRef.current = {
          lat: newPos.lat,
          lng: newPos.lng,
          time: newPos.timestamp,
          accuracy: newPos.accuracy,
        };

        setLocation({
          lat: newPos.lat,
          lng: newPos.lng,
          timestamp: newPos.timestamp,
        });
        setCurrentAccuracy(newPos.accuracy);
      },
       (err) => {
         console.error('Watch position error:', err);
         const ge = err as GeolocationPositionError;
         if (ge.code === ge.PERMISSION_DENIED) {
           setError('Location permission denied. Please enable location access.');
         } else if (ge.code === ge.POSITION_UNAVAILABLE) {
           setError('Location information unavailable.');
         } else if (ge.code === ge.TIMEOUT) {
           setError('Location update timed out.');
         } else {
           setError('Failed to track location.');
         }
       },
      {
        enableHighAccuracy: true,
        // Don’t force 3s timeouts; watchPosition cadence is device/browser-driven.
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }, [isTracking]);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsTracking(false);
  }, []);

  useEffect(() => {
    if (enabled && !location) {
      requestLocation();
    }
  }, [enabled, location, requestLocation]);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  return {
    location,
    error,
    isLoading,
    isTracking,
    requestLocation,
    startTracking,
    stopTracking,
    cumulativeDistance,
    lastMovementDistance,
    currentAccuracy,
    currentSpeed,
    currentSegmentDist,
  };
}
