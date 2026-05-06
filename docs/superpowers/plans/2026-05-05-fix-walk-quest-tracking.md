# Fix Walk Quest GPS Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix travel/walk quests so distance accumulates correctly and quests complete when the player walks the required distance.

**Architecture:** Two bugs exist: (1) `useEffect` in `app/page.tsx` re-fires after every progress update because `gameState` is in its dependency array, causing the same GPS segment distance to be counted multiple times; (2) the dev sim mode (`?lat=X&lng=Y`) sets a static location with no movement updates, making walk quests untestable in dev. Fix (1) by replacing `gameState` in the effect dep array with a `gameStateRef`. Fix (2) by extending the sim mode to replay a sequence of waypoints.

**Tech Stack:** Next.js 16, React 19, TypeScript, browser Geolocation API (`watchPosition`)

---

## Root Cause Analysis

### Bug 1 — Double (and N-times) distance counting

`app/page.tsx` line 221–310: the effect that handles GPS movement has dep array:
```ts
}, [gameState, location, distanceFromLast, getNextQuestWithPois, showAchievementToasts, lastLocationForQuest, stopTracking]);
```

Flow that causes the bug:
1. GPS fires → `lastMovementDistance = 5 m` + new `location` object → React re-renders
2. Effect fires (because `location` and `distanceFromLast` both changed) → `quest.progress += 5 m` → `setGameState(...)` called
3. `gameState` changes → React re-renders
4. Effect fires **again** (because `gameState` changed) → `lastMovementDistance` still `5 m` → `quest.progress += 5 m` AGAIN
5. Step 3–4 may loop until next GPS update resets `lastMovementDistance` to `0`

**Fix:** Keep `gameState` out of the dep array. Read it via a `gameStateRef` (a `useRef` kept in sync with the state via a separate small effect).

### Bug 2 — Sim mode has no movement

`lib/useLocation.ts` `startTracking()` calls `navigator.geolocation.watchPosition`. When `?lat=X&lng=Y` is in the URL, `requestLocation()` returns a static location — but `startTracking` is never overridden, so `watchPosition` runs on real device GPS (which returns nothing in a browser test env). Result: `lastMovementDistance` stays `0` forever; travel quest progress never moves.

**Fix:** When URL contains `?lat=X&lng=Y`, extend sim mode to also accept `?waypoints=lat1,lng1;lat2,lng2;...` and replay waypoints via `setInterval` inside `startTracking`.

---

## File Map

| File | Change |
|------|--------|
| `app/page.tsx` | Replace `gameState` dep with `gameStateRef`; remove `location` from dep (not needed separately) |
| `lib/useLocation.ts` | Add waypoint sim mode to `startTracking` |

---

### Task 1: Fix double-counting — add `gameStateRef`

**Files:**
- Modify: `app/page.tsx` (lines ~79–310)

- [ ] **Step 1: Add `gameStateRef` below the existing `gameState` useState**

Open `app/page.tsx`. After the line:
```ts
const [gameState, setGameState] = useState<GameState | null>(null);
```
add:
```ts
const gameStateRef = useRef<GameState | null>(null);
```
(The file already imports `useRef` from React.)

- [ ] **Step 2: Keep `gameStateRef` in sync with `gameState`**

Add this effect immediately after the ref declaration (before the large travel-quest effect):
```ts
useEffect(() => {
  gameStateRef.current = gameState;
}, [gameState]);
```

- [ ] **Step 3: Rewrite the travel-quest effect to use `gameStateRef` and remove `gameState` from deps**

Replace the existing effect (lines 221–310) with the version below. Key changes:
- Read state via `gameStateRef.current` instead of `gameState`
- Remove `gameState` from the dependency array
- Keep `location` in dep array only to detect new GPS fixes (the guard `lastMovementDistance <= 0` handles non-movement renders)

```ts
useEffect(() => {
  const gs = gameStateRef.current;
  if (!gs || !location || lastMovementDistance <= 0) return;

  const quest = gs.currentQuest;
  const completesTravel = quest?.type === 'travel' && quest.progress + lastMovementDistance >= quest.goal;

  if (!completesTravel) {
    setGameState(prev => {
      if (!prev) return prev;
      const newDist = (prev.player.totalDistance ?? 0) + lastMovementDistance;
      const newState: GameState = {
        ...prev,
        player: { ...prev.player, lastLocation: location, lastActive: Date.now(), totalDistance: newDist },
      };
      if (prev.currentQuest?.type === 'travel') {
        newState.currentQuest = { ...prev.currentQuest, progress: prev.currentQuest.progress + lastMovementDistance };
      }
      saveGameState(newState);
      return newState;
    });
    return;
  }

  const completeTravelQuest = async () => {
    const newDist = (gs.player.totalDistance ?? 0) + lastMovementDistance;
    const chainMultiplier = gs.player.currentChain?.multiplier ?? 1;
    const xp = Math.round(quest.xpReward * getQuestXpMultiplier(gs.player.level) * chainMultiplier);
    const newXp = gs.player.xp + xp;
    const newLevel = calculateLevel(newXp);
    const updatedChain = gs.player.currentChain
      ? { ...gs.player.currentChain, stepIndex: gs.player.currentChain.stepIndex + 1, xpEarned: gs.player.currentChain.xpEarned + xp }
      : null;

    const basePlayer = {
      ...gs.player,
      xp: newXp,
      level: newLevel,
      completedQuests: [...gs.player.completedQuests, quest.id],
      currentChain: updatedChain,
      lastLocation: location,
      lastActive: Date.now(),
      totalDistance: newDist,
    };

    const newState: GameState = {
      ...gs,
      player: basePlayer,
      currentSession: gs.currentSession
        ? { ...gs.currentSession, xpEarned: gs.currentSession.xpEarned + xp, questsCompleted: gs.currentSession.questsCompleted + 1 }
        : null,
    };

    let chainCompleted = false;
    if (updatedChain && updatedChain.stepIndex >= updatedChain.totalSteps) {
      const bonusXp = Math.round(updatedChain.xpEarned * 0.3);
      const bonusTotal = newXp + bonusXp;
      newState.player = {
        ...newState.player,
        xp: bonusTotal,
        level: calculateLevel(bonusTotal),
        currentChain: null,
        chainCompletions: (newState.player.chainCompletions ?? 0) + 1,
      };
      chainCompleted = true;
      setQuestMessage(`CHAIN COMPLETE  ·  +${bonusXp} XP BONUS`);
      newState.currentQuest = getRandomQuest(newState.player.completedQuests, newState.player.level);
      stopTracking();
    } else {
      const result = await getNextQuestWithPois(newState.player.completedQuests, newLevel, updatedChain, lastLocationForQuest);
      newState.currentQuest = result.quest;
      newState.player.currentChain = result.chain;
    }

    const unlocked = checkNewAchievements(newState);
    if (unlocked.length) {
      newState.player = { ...newState.player, achievements: [...newState.player.achievements, ...unlocked] };
      showAchievementToasts(unlocked);
    }

    saveGameState(newState);
    if (!chainCompleted) setQuestMessage(`QUEST COMPLETE  ·  +${xp} XP`);
    setGameState(newState);
  };

  completeTravelQuest();
}, [location, lastMovementDistance, getNextQuestWithPois, showAchievementToasts, lastLocationForQuest, stopTracking]);
```

- [ ] **Step 4: Run the linter to verify no type errors**

```bash
npm run lint
```
Expected: no errors related to `gameState` or `gameStateRef`.

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx
git commit -m "fix(tracking): prevent double-counting GPS segments

useEffect dep on gameState caused the travel-quest distance effect
to re-fire after every progress update, counting each GPS segment
multiple times. Replace gameState dep with gameStateRef."
```

---

### Task 2: Fix sim mode — add waypoint replay in `startTracking`

**Files:**
- Modify: `lib/useLocation.ts`

This adds an alternative path inside `startTracking` that, when URL params contain `?lat=X&lng=Y&simPath=lat1,lng1;lat2,lng2;...`, replays those waypoints at 2-second intervals instead of calling `watchPosition`.

- [ ] **Step 1: Add a helper to parse sim waypoints from URL**

In `lib/useLocation.ts`, add this pure function before the `useLocation` export:

```ts
function getSimWaypoints(): Array<{ lat: number; lng: number }> | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('simPath');
  if (!raw) return null;
  return raw.split(';').map(pair => {
    const [lat, lng] = pair.split(',').map(Number);
    return { lat, lng };
  }).filter(p => !isNaN(p.lat) && !isNaN(p.lng));
}
```

- [ ] **Step 2: Extend `startTracking` to use waypoints when present**

Replace the body of `startTracking` (currently lines 107–189) with the version below. The real `watchPosition` path is unchanged. A new branch checks `getSimWaypoints()` and replays them via `setInterval`.

```ts
const startTracking = useCallback(() => {
  if (isTracking || !navigator.geolocation) return;

  setIsTracking(true);
  setCumulativeDistance(0);
  setLastMovementDistance(0);
  lastProcessedRef.current = null;

  const waypoints = getSimWaypoints();
  if (waypoints && waypoints.length > 1) {
    let idx = 0;
    const intervalId = window.setInterval(() => {
      idx++;
      if (idx >= waypoints.length) {
        window.clearInterval(intervalId);
        watchIdRef.current = null;
        return;
      }
      const prev = waypoints[idx - 1];
      const curr = waypoints[idx];
      const now = Date.now();

      setLastMovementDistance(0);
      setCurrentSpeed(null);
      setCurrentSegmentDist(null);

      if (lastProcessedRef.current) {
        const timeDiff = (now - lastProcessedRef.current.time) / 1000;
        if (timeDiff > 0) {
          const segmentDist = calculateDistance(prev.lat, prev.lng, curr.lat, curr.lng);
          const speedMps = segmentDist / timeDiff;
          setCurrentSegmentDist(segmentDist);
          setCurrentSpeed(speedMps);
          if (speedMps <= MAX_SPEED_MPS && segmentDist >= MIN_MOVEMENT) {
            setCumulativeDistance(d => d + segmentDist);
            setLastMovementDistance(segmentDist);
          }
        }
      }

      lastProcessedRef.current = { lat: curr.lat, lng: curr.lng, time: now, accuracy: 1 };
      setLocation({ lat: curr.lat, lng: curr.lng, timestamp: now });
      setCurrentAccuracy(1);
    }, 2000);
    // Store interval ID in watchIdRef so stopTracking clears it
    watchIdRef.current = intervalId as unknown as number;
    // Set initial position
    const first = waypoints[0];
    const now = Date.now();
    lastProcessedRef.current = { lat: first.lat, lng: first.lng, time: now, accuracy: 1 };
    setLocation({ lat: first.lat, lng: first.lng, timestamp: now });
    setCurrentAccuracy(1);
    return;
  }

  watchIdRef.current = navigator.geolocation.watchPosition(
    (pos) => {
      const accuracy = pos.coords.accuracy;
      const newPos: Position = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        timestamp: Date.now(),
        accuracy,
      };

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
          const accurateEnough = newPos.accuracy <= MIN_ACCURACY;
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
      setLocation({ lat: newPos.lat, lng: newPos.lng, timestamp: newPos.timestamp });
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
      timeout: 10000,
      maximumAge: 0,
    }
  );
}, [isTracking]);
```

- [ ] **Step 3: Run the linter**

```bash
npm run lint
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add lib/useLocation.ts
git commit -m "feat(sim): add waypoint replay mode for walk quest testing

Sim mode ?lat=X&lng=Y gives a static location; walk quests need
movement to progress. Adding ?simPath=lat1,lng1;lat2,lng2;...
replays waypoints at 2s intervals so tracking can be tested without
real device GPS."
```

---

### Task 3: Manual test — verify walk quest works end-to-end

**Files:** none (test only)

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```
Expected: server at `http://localhost:3000`

- [ ] **Step 2: Open test URL with a simulated 120m walk (six waypoints, ~20m apart)**

Open in browser:
```
http://localhost:3000/?lat=1.3521&lng=103.8198&simPath=1.3521,103.8198;1.35228,103.8198;1.35246,103.8198;1.35264,103.8198;1.35282,103.8198;1.35300,103.8198
```
Each step is ~20m north. Total ~100m. If the current active quest is a 100m travel quest, it should complete after all waypoints play.

- [ ] **Step 3: Verify TEST MODE banner is visible**

The banner `TEST MODE` should appear at the top of the screen, confirming sim URL params are active.

- [ ] **Step 4: Start journey and observe**

Click "BEGIN JOURNEY". If the assigned quest is not a travel quest, use the debug "Skip Quest" button (always visible per CLAUDE.md) until a travel quest appears.

- [ ] **Step 5: Watch progress bar increment every 2 seconds**

Each waypoint fires every 2 seconds. The quest progress bar should increment by ~20m each tick. Watch for:
- Progress bar moves forward (not stuck at 0)
- Debug panel shows `lastMovement: ~20.0 m` each tick
- `cumulative` increases by ~20m each tick
- Distance is NOT added twice per tick (verify by watching the debug panel)

- [ ] **Step 6: Verify quest completes after ~100m**

After ~5 ticks (10 seconds), the quest should complete and show `QUEST COMPLETE · +N XP`. A new quest should appear automatically.

- [ ] **Step 7: Verify no double-counting**

In the debug panel, after the first waypoint fires, `lastMovement` shows ~20m. It should show 0 on the next render before the next waypoint fires. If it stays at 20m and progress jumps by 40m, the double-counting bug is still present.

---

## Self-Review Checklist

**Spec coverage:**
- [x] Double-counting bug identified and fixed (Task 1)
- [x] Dev testing of walk quests enabled (Task 2)
- [x] End-to-end manual test procedure (Task 3)

**Placeholder scan:** No TBD/TODO/placeholder text present.

**Type consistency:**
- `gameStateRef` typed as `useRef<GameState | null>(null)` — matches `useState<GameState | null>`
- `lastMovementDistance` used directly (not aliased as `distanceFromLast` in new effect) — consistent with hook return type
- `getSimWaypoints()` returns `Array<{ lat: number; lng: number }> | null` — matches waypoints loop access pattern

**Edge cases covered:**
- Single-waypoint `simPath` (< 2 points): falls through to real `watchPosition`
- Malformed `simPath` entries: filtered by `isNaN` check
- `stopTracking` clears `watchIdRef.current` — works for both `watchPosition` IDs and `setInterval` IDs since `clearWatch` and `clearInterval` both accept numeric IDs (in browsers, IDs are distinct integer pools so this is safe to keep separate — but `clearWatch` won't error on an unknown ID)

**Note on `stopTracking` and interval IDs:** Browser `clearWatch` and `clearInterval` use separate ID spaces. The current `stopTracking` calls `navigator.geolocation.clearWatch(watchIdRef.current)` — this won't clear a `setInterval`. The fix: detect sim mode in `stopTracking` as well, or store a separate `simIntervalRef`. This is addressed in Task 2 Step 2 by storing the interval ID in `watchIdRef` — but `clearWatch` will silently no-op on an interval ID. **Add a `simIntervalRef`** to properly clear the interval:

In `lib/useLocation.ts`, add alongside `watchIdRef`:
```ts
const simIntervalRef = useRef<number | null>(null);
```

In `startTracking` sim branch, store as `simIntervalRef.current = intervalId`.

In `stopTracking`:
```ts
const stopTracking = useCallback(() => {
  if (simIntervalRef.current !== null) {
    window.clearInterval(simIntervalRef.current);
    simIntervalRef.current = null;
  }
  if (watchIdRef.current !== null) {
    navigator.geolocation.clearWatch(watchIdRef.current);
    watchIdRef.current = null;
  }
  setIsTracking(false);
}, []);
```

This correction should be applied in Task 2 Step 2.
