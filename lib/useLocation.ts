'use client';
import { useState, useCallback, useEffect } from 'react';
import { Location } from './types';
import { calculateDistance } from './game';

interface UseLocationResult {
  location: Location | null;
  error: string | null;
  isLoading: boolean;
  requestLocation: () => Promise<void>;
  distanceFromLast: number | null;
}

export function useLocation(lastLocation: Location | null, enabled: boolean = false): UseLocationResult {
  const [location, setLocation] = useState<Location | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [distanceFromLast, setDistanceFromLast] = useState<number | null>(null);

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
      if (lastLocation) {
        const dist = calculateDistance(
          lastLocation.lat,
          lastLocation.lng,
          simulatedLocation.lat,
          simulatedLocation.lng
        );
        setDistanceFromLast(dist);
      }
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

      if (lastLocation) {
        const dist = calculateDistance(
          lastLocation.lat,
          lastLocation.lng,
          newLocation.lat,
          newLocation.lng
        );
        setDistanceFromLast(dist);
      }
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
  }, [lastLocation]);

  useEffect(() => {
    if (enabled && !location) {
      requestLocation();
    }
  }, [enabled, location, requestLocation]);

  return { location, error, isLoading, requestLocation, distanceFromLast };
}