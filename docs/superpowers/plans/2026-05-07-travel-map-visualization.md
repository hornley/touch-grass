# Travel Map Visualization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a live map during travel quests displaying the player's current position and movement trail, matching the existing dark RPG aesthetic.

**Architecture:** Add a `TravelMap` component (Leaflet + react-leaflet, `ssr: false`) that receives `currentLocation` and `motionState` as props, maintains an internal position history buffer, renders a dark-tiled map with player dot and trail polyline, and is mounted only when `currentQuest.type === 'travel'` inside `app/page.tsx`. No new state in `page.tsx` — all map-internal state lives in the component.

**Tech Stack:** `leaflet@1.9`, `react-leaflet@4`, CartoDB Dark Matter tiles (free, no API key), Next.js `dynamic()` with `ssr: false`.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `components/TravelMap.tsx` | Create | Map UI: tiles, player marker, trail polyline |
| `components/TravelMapWrapper.tsx` | Create | `dynamic()` wrapper with `ssr: false` |
| `app/page.tsx` | Modify | Mount wrapper inside travel quest section |
| `package.json` | Modify | Add `leaflet`, `react-leaflet`, `@types/leaflet` |

---

## Task 1: Install dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install leaflet and react-leaflet**

```bash
cd /Users/wayne/dev/touch-grass
npm install leaflet@1.9.4 react-leaflet@4.2.1
npm install -D @types/leaflet@1.9.14
```

Expected output: no peer dependency errors. `package.json` should now list `leaflet` and `react-leaflet` under `dependencies`.

- [ ] **Step 2: Verify install**

```bash
node -e "require('./node_modules/leaflet/package.json')" && echo "OK"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git checkout -b feature/travel-map-visualization
git add package.json package-lock.json
git commit -m "chore: add leaflet and react-leaflet for travel map"
```

---

## Task 2: Create TravelMap component

**Files:**
- Create: `components/TravelMap.tsx`

This is the real map component. It MUST NOT be imported directly in any server-rendered file — only through `TravelMapWrapper` (Task 3).

- [ ] **Step 1: Create the component**

```tsx
// components/TravelMap.tsx
'use client';
import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Location } from '@/lib/types';
import { MotionState } from '@/lib/slidingWindowTracker';

// Leaflet's default icon asset paths break in Next.js — point them at the CDN copy
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const MAX_TRAIL_POINTS = 80;

function PlayerMarker({ position }: { position: [number, number] }) {
  const map = useMap();

  useEffect(() => {
    map.setView(position, map.getZoom(), { animate: true, duration: 0.5 });
  }, [map, position]);

  useEffect(() => {
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
    const marker = L.marker(position, { icon }).addTo(map);
    return () => { marker.remove(); };
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
  const trailRef = useRef<[number, number][]>([]);

  const pos: [number, number] = [currentLocation.lat, currentLocation.lng];

  const last = trailRef.current[trailRef.current.length - 1];
  if (!last || last[0] !== pos[0] || last[1] !== pos[1]) {
    trailRef.current = [...trailRef.current, pos].slice(-MAX_TRAIL_POINTS);
  }

  const trail = trailRef.current;
  const pct = Math.min(100, Math.round((progress / goal) * 100));

  return (
    <div style={{ position: 'relative', borderRadius: '2px', overflow: 'hidden', border: '1px solid #2a3d52' }}>
      <MapContainer
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
```

- [ ] **Step 2: Commit**

```bash
git add components/TravelMap.tsx
git commit -m "feat: add TravelMap component with Leaflet dark tiles and trail"
```

---

## Task 3: Create SSR wrapper

**Files:**
- Create: `components/TravelMapWrapper.tsx`

Next.js runs component imports through the server. Leaflet touches `window` at module load, which crashes SSR. The wrapper uses `dynamic()` so the real component is only loaded client-side.

- [ ] **Step 1: Create the wrapper**

```tsx
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
```

- [ ] **Step 2: Commit**

```bash
git add components/TravelMapWrapper.tsx
git commit -m "feat: add TravelMapWrapper with ssr:false dynamic import"
```

---

## Task 4: Integrate map into page.tsx

**Files:**
- Modify: `app/page.tsx:896-912` (the travel quest section)

The travel quest currently renders a progress bar. Replace that section with the map (which includes its own progress bar) when a location is available. Keep the existing progress bar as fallback when `location` is null.

- [ ] **Step 1: Import the wrapper at the top of page.tsx**

In `app/page.tsx`, find the existing imports block (around line 21-26) and add:

```tsx
import { TravelMapWrapper } from '@/components/TravelMapWrapper';
```

- [ ] **Step 2: Replace the travel quest progress section**

Find this block in `app/page.tsx` (around line 896):

```tsx
                    {gameState.currentQuest.type === 'travel' && (
                      <div>
                        <div style={{ height: '5px', background: '#172030', border: '1px solid #2a3d52', overflow: 'hidden', marginBottom: '6px' }}>
                          <div style={{
                            height: '100%',
                            width: `${Math.min(100, (gameState.currentQuest.progress / gameState.currentQuest.goal) * 100)}%`,
                            background: 'linear-gradient(90deg, #1e3a8a, #3b82f6)',
                            transition: 'width 0.5s ease',
                          }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '10px', color: '#6a8898' }}>PROGRESS</span>
                          <span style={{ fontFamily: 'var(--font-cinzel)', fontSize: '11px', color: '#93c5fd' }}>
                            {Math.round(gameState.currentQuest.progress)} M &nbsp;╱&nbsp; {gameState.currentQuest.goal} M
                          </span>
                        </div>
                      </div>
                    )}
```

Replace with:

```tsx
                    {gameState.currentQuest.type === 'travel' && (
                      <div>
                        {location ? (
                          <TravelMapWrapper
                            currentLocation={location}
                            motionState={motionState}
                            progress={gameState.currentQuest.progress}
                            goal={gameState.currentQuest.goal}
                          />
                        ) : (
                          <>
                            <div style={{ height: '5px', background: '#172030', border: '1px solid #2a3d52', overflow: 'hidden', marginBottom: '6px' }}>
                              <div style={{
                                height: '100%',
                                width: `${Math.min(100, (gameState.currentQuest.progress / gameState.currentQuest.goal) * 100)}%`,
                                background: 'linear-gradient(90deg, #1e3a8a, #3b82f6)',
                                transition: 'width 0.5s ease',
                              }} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ fontSize: '10px', color: '#6a8898' }}>PROGRESS</span>
                              <span style={{ fontFamily: 'var(--font-cinzel)', fontSize: '11px', color: '#93c5fd' }}>
                                {Math.round(gameState.currentQuest.progress)} M &nbsp;╱&nbsp; {gameState.currentQuest.goal} M
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    )}
```

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat: integrate TravelMap into travel quest card"
```

---

## Task 5: Verify in browser

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

Expected: compiles without errors, server at `http://localhost:3000`.

- [ ] **Step 2: Load test mode with a travel quest**

Open: `http://localhost:3000/?lat=51.505&lng=-0.09`

In the debug panel, click a `travel` quest type button to force a travel quest.

Expected:
- Map renders with dark CartoDB tiles
- Blue dot appears at the simulated location
- Progress bar overlaid at map bottom
- `LOADING MAP` placeholder shows briefly before tiles load

- [ ] **Step 3: Simulate movement**

Change URL to `http://localhost:3000/?lat=51.506&lng=-0.09` (100m north).

Expected:
- Map re-centers on new position
- Blue polyline trail appears between old and new position

- [ ] **Step 4: Verify fallback when no location**

Load `http://localhost:3000` (no lat/lng params, deny location permission).

Expected: travel quest shows the old progress bar fallback, not the map.

- [ ] **Step 5: Run lint**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "chore: verify travel map integration works in browser"
```

---

## Self-Review

**Spec coverage:**
- ✅ Library choice (Leaflet) — Task 1
- ✅ Component structure (TravelMap + wrapper) — Tasks 2–3
- ✅ Player position marker — Task 2, `PlayerMarker`
- ✅ Movement trail polyline — Task 2, `Polyline`
- ✅ Distance/progress indicator — Task 2, overlay
- ✅ Motion state display (WALKING / FAST) — Task 2, overlay
- ✅ Integration with `useLocation` hook data — Task 4 (`location`, `motionState` props)
- ✅ SSR safety — Task 3
- ✅ Test mode `?lat=X&lng=Y` — works automatically since `location` comes from `useLocation` which already reads query params
- ✅ Fallback when no GPS — Task 4 (old progress bar renders when `location` is null)
- ✅ Dark RPG aesthetic — CartoDB Dark Matter tiles, blue trail matching `#3b82f6` brand color

**Placeholder scan:** No TBD or TODO items. All code blocks complete.

**Type consistency:**
- `TravelMapProps` defined in `TravelMap.tsx`, re-exported via `TravelMapWrapperProps` in wrapper with identical shape — consistent.
- `Location` and `MotionState` both imported from existing `lib/types.ts` and `lib/slidingWindowTracker.ts` — no invented types.
- `motionState` prop: `MotionState | null` — matches what `useLocation` returns.
