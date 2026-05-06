'use client';
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Location } from '@/lib/types';

interface VisitQuestMapProps {
  currentLocation: Location;
  targetLat: number;
  targetLng: number;
  targetName: string;
  radiusM?: number;
}

export default function VisitQuestMap({
  currentLocation,
  targetLat,
  targetLng,
  targetName,
  radiusM = 50,
}: VisitQuestMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const targetMarkerRef = useRef<L.Marker | null>(null);
  const radiusCircleRef = useRef<L.Circle | null>(null);
  const initializedRef = useRef(false);

  const userLat = currentLocation.lat;
  const userLng = currentLocation.lng;
  const userPos: [number, number] = [userLat, userLng];
  const targetPos: [number, number] = [targetLat, targetLng];

  useEffect(() => {
    if (!mapContainerRef.current || initializedRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: userPos,
      zoom: 17,
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 20,
    }).addTo(map);

    mapRef.current = map;
    initializedRef.current = true;

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        initializedRef.current = false;
      }
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
    }
    const userIcon = L.divIcon({
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
    userMarkerRef.current = L.marker(userPos, { icon: userIcon }).addTo(map);

    if (targetMarkerRef.current) {
      targetMarkerRef.current.remove();
    }
    const targetIcon = L.divIcon({
      className: '',
      html: `
        <div style="
          width:12px;height:12px;
          background:#d4a030;
          border:2px solid #fbbf24;
          border-radius:50%;
          box-shadow:0 0 8px rgba(212,160,48,0.8);
        "></div>`,
      iconSize: [12, 12],
      iconAnchor: [6, 6],
    });
    targetMarkerRef.current = L.marker(targetPos, { icon: targetIcon, title: targetName }).addTo(map);

    if (radiusCircleRef.current) {
      radiusCircleRef.current.remove();
    }
    radiusCircleRef.current = L.circle(targetPos, {
      radius: radiusM,
      color: '#d4a030',
      fillColor: '#d4a030',
      fillOpacity: 0.15,
      weight: 1,
    }).addTo(map);

    const bounds = L.latLngBounds([userPos, targetPos]);
    map.fitBounds(bounds, { padding: [50, 50] });
  }, [userLat, userLng, targetLat, targetLng, targetName, radiusM]);

  return (
    <div style={{ position: 'relative', borderRadius: '2px', overflow: 'hidden', border: '1px solid #2a3d52', marginTop: '8px' }}>
      <div
        ref={mapContainerRef}
        style={{ height: '220px', width: '100%', background: '#0d1520' }}
      />
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 800,
        background: 'linear-gradient(to top, rgba(13,21,32,0.85), transparent)',
        padding: '8px 12px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '9px', letterSpacing: '1px', color: '#3b82f6', fontFamily: 'var(--font-cinzel)' }}>
            ● YOU
          </span>
          <span style={{ fontSize: '9px', letterSpacing: '1px', color: '#d4a030', fontFamily: 'var(--font-cinzel)' }}>
            ◆ TARGET ({radiusM}m)
          </span>
        </div>
        <div style={{ fontFamily: 'var(--font-inconsolata)', fontSize: '10px', color: '#6a8898', maxWidth: '50%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {targetName}
        </div>
      </div>
    </div>
  );
}