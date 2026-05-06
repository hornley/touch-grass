// components/TravelMapWrapper.tsx
'use client';
import dynamic from 'next/dynamic';
import { Location } from '@/lib/types';
import { MotionState } from '@/lib/slidingWindowTracker';

const TravelMap = dynamic(() => import('./TravelMap'), {
  ssr: false,
  loading: () => (
    <div style={{
      height: '220px',
      background: '#0d1520',
      border: '1px solid #2a3d52',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <span style={{ fontFamily: 'var(--font-cinzel)', fontSize: '9px', letterSpacing: '3px', color: '#2a3d52' }}>
        LOADING MAP
      </span>
    </div>
  ),
});

interface TravelMapWrapperProps {
  currentLocation: Location;
  motionState: MotionState | null;
  progress: number;
  goal: number;
}

export function TravelMapWrapper(props: TravelMapWrapperProps) {
  return <TravelMap {...props} />;
}