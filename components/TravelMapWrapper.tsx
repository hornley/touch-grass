// components/TravelMapWrapper.tsx
'use client';
import { Location } from '@/lib/types';
import { MotionState } from '@/lib/slidingWindowTracker';
import TravelMap from './TravelMap';

interface TravelMapWrapperProps {
  currentLocation: Location;
  motionState: MotionState | null;
  progress: number;
  goal: number;
}

export function TravelMapWrapper(props: TravelMapWrapperProps) {
  return <TravelMap {...props} />;
}