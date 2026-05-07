'use client';
import dynamic from 'next/dynamic';
import { Location } from '@/lib/types';

const VisitQuestMap = dynamic(() => import('./VisitQuestMap'), {
  ssr: false,
  loading: () => (
    <div style={{
      height: '220px',
      background: '#0d1520',
      border: '1px solid #2a3d52',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      marginTop: '8px',
    }}>
      <span style={{ fontFamily: 'var(--font-cinzel)', fontSize: '9px', letterSpacing: '3px', color: '#2a3d52' }}>
        LOADING MAP
      </span>
    </div>
  ),
});

interface VisitQuestMapWrapperProps {
  currentLocation: Location;
  targetLat: number;
  targetLng: number;
  targetName: string;
  radiusM?: number;
}

export default function VisitQuestMapWrapper(props: VisitQuestMapWrapperProps) {
  return <VisitQuestMap {...props} />;
}