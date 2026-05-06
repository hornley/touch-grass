// components/TravelMap.tsx
'use client';
import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Location } from '@/lib/types';
import { MotionState } from '@/lib/slidingWindowTracker';

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const MAX_TRAIL_POINTS = 80;

function PlayerMarker({ position }: { position: [number, number] }) {
  const map = useMap();
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    map.setView(position, map.getZoom(), { animate: true, duration: 0.5 });
  }, [map, position]);

  useEffect(() => {
    if (markerRef.current) {
      markerRef.current.remove();
    }
    const icon = L.divIcon({
      className: '',
      html: `
        <div style="
          width:14px;height:14px;
          background:#3b82f6;
          border:2px solid #93c5fd;
          border-radius:50%;
          box-shadow:0 0 8px rgba(59,130,246,0.8);
        "></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    });
    markerRef.current = L.marker(position, { icon }).addTo(map);
    return () => {
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
    };
  }, [map, position]);

  return null;
}

interface TravelMapProps {
  currentLocation: Location;
  motionState: MotionState | null;
  progress: number;
  goal: number;
}

export default function TravelMap({ currentLocation, motionState, progress, goal }: TravelMapProps) {
  const pos: [number, number] = [currentLocation.lat, currentLocation.lng];
  const lat = currentLocation.lat;
  const lng = currentLocation.lng;
  const initialPosKey = `${lat.toFixed(5)},${lng.toFixed(5)}`;

  const [trail, setTrail] = useState<[number, number][]>([]);
  const isInitialized = useRef(false);

  useEffect(() => {
    if (!isInitialized.current) {
      setTrail([pos]);
      isInitialized.current = true;
    } else {
      setTrail((prev) => {
        const last = prev[prev.length - 1];
        if (!last || last[0] !== lat || last[1] !== lng) {
          return [...prev, pos].slice(-MAX_TRAIL_POINTS);
        }
        return prev;
      });
    }
  }, [lat, lng, pos]);

  const pct = Math.min(100, Math.round((progress / goal) * 100));

  return (
    <div style={{ position: 'relative', borderRadius: '2px', overflow: 'hidden', border: '1px solid #2a3d52' }}>
      <MapContainer
        key={initialPosKey}
        center={pos}
        zoom={17}
        style={{ height: '220px', width: '100%', background: '#0d1520' }}
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
          maxZoom={20}
        />
        {trail.length >= 2 && (
          <Polyline
            positions={trail}
            pathOptions={{ color: '#3b82f6', weight: 3, opacity: 0.7 }}
          />
        )}
        <PlayerMarker position={pos} />
      </MapContainer>

      {/* progress overlay */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 800,
        background: 'linear-gradient(to top, rgba(13,21,32,0.85), transparent)',
        padding: '8px 12px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
      }}>
        <div style={{ flex: 1, marginRight: '12px' }}>
          <div style={{ height: '3px', background: '#172030', border: '1px solid #2a3d52', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${pct}%`,
              background: 'linear-gradient(90deg, #1e3a8a, #3b82f6)',
              transition: 'width 0.5s ease',
            }} />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {motionState === 'walking' && (
            <span style={{ fontSize: '9px', letterSpacing: '2px', color: '#4ade80', fontFamily: 'var(--font-cinzel)' }}>
              ● WALKING
            </span>
          )}
          {motionState === 'movingFast' && (
            <span style={{ fontSize: '9px', letterSpacing: '2px', color: '#fca5a5', fontFamily: 'var(--font-cinzel)' }}>
              ⚡ FAST
            </span>
          )}
          <span style={{ fontFamily: 'var(--font-cinzel)', fontSize: '11px', color: '#93c5fd' }}>
            {Math.round(progress)}m / {goal}m
          </span>
        </div>
      </div>
    </div>
  );
}