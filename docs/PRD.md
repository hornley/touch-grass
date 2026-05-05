# TerraQuest — Product Requirements Document

## What is TerraQuest?

TerraQuest is a client-side real-world RPG built as a mobile web app. The player's physical movement in the real world directly affects a fantasy game world. Moving, taking photos, and being active heals the realm from corruption. Staying idle lets it decay.

Built for a hackathon. Target: solo casual players who want a lightweight reason to go outside.

---

## Core Loop

1. Player opens app → gets assigned a quest
2. Quest requires real-world action (walk X meters, take a photo, wait away from app)
3. Completing quest earns XP, reduces world corruption
4. World corruption grows passively when player is inactive
5. Player levels up, unlocks XP bonuses, earns achievement badges
6. Daily streaks reward consistent engagement

---

## Game Mechanics

### World Corruption
- Grows +10% per 5 minutes of inactivity (`updateWorldState`)
- States: `stable` (0–49%) → `warning` (50–79%) → `corrupted` (80–100%)
- Reduced by: completing quests, moving 100m+

### XP & Leveling
- Formula: `level = floor(sqrt(xp / 100)) + 1`
- XP multiplier by level: 1.0× (default) → 1.2× (level 3+) → 1.5× (level 7+)
- Next level threshold: `level² × 100` XP

### Quest Types
| Type | Trigger | How to complete |
|------|---------|-----------------|
| `travel` | GPS distance | Walk required meters |
| `photo` | Camera | Take/upload a photo |
| `wait` | Time | Leave app for 5+ min, return |

- Quest pool cycles; resets when all quests completed
- Level 5+ unlocks harder travel quest (1km, 50 XP)

### Away Reward
- Minutes offline → XP on return
- Base: 1 XP/min, capped at 60 min
- Overtime (>60 min): 2 XP/min
- Minimum 2 minutes away to qualify

### Daily Streak
- Increments when player opens app on consecutive days
- Breaks if more than 1 day skipped
- Tracked via `lastStreakDate` (YYYY-MM-DD)

### Achievements (9 total)
| ID | Condition |
|----|-----------|
| `first_quest` | Complete 1 quest |
| `photographer_3` | Complete 3 photo quests |
| `photographer_10` | Complete 10 photo quests |
| `explorer_500m` | Walk 500m total |
| `explorer_1km` | Walk 1km total |
| `streak_3` | 3-day streak |
| `streak_7` | 7-day streak |
| `level_5` | Reach level 5 |
| `guardian` | Reduce corruption to 0% |

---

## Technical Architecture

- **Stack**: Next.js 16, React 19, TypeScript, Tailwind v4
- **No backend** — all state in `localStorage` under key `terraquest_state`
- **No auth** — single anonymous player per device
- **GPS**: browser `navigator.geolocation` API; requires HTTPS in production
- **Camera**: `navigator.mediaDevices.getUserMedia`; falls back to file upload

### Key files
```
lib/types.ts       — all TypeScript interfaces
lib/game.ts        — pure game logic (XP, quests, corruption, achievements)
lib/useLocation.ts — geolocation hook
app/page.tsx       — single page, all game state via useState + useEffect
components/        — BottomNav, StatsTab, AchievementsTab, CameraCapture
```

### Location simulation (dev/testing)
Append `?lat=X&lng=Y` to URL — bypasses real GPS. Page shows TEST MODE banner.

### Debug panel
`app/page.tsx` has a hardcoded `if (true)` debug panel (Skip Quest, Reset Game) — always visible in all environments.

---

## UI Structure

Three tabs via bottom nav:

| Tab | Icon | Content |
|-----|------|---------|
| REALM | ⬡ | Main game: player card, world state, active quest, coordinates |
| CODEX | ◈ | Stats: quest breakdown, distance, session history |
| MARKS | ✦ | Achievements: badge grid, locked/unlocked |

### Design system
- Fonts: Cinzel (headings/labels) + Inconsolata (body/data)
- Colors: void-black background, amber `#d4a030` accent, state-reactive (green/amber/red)
- Level displayed as Roman numerals (RANK VII)
- XP shown as 10-segment bar

---

## What's NOT built yet

- Multiplayer / leaderboards (deferred — requires backend + auth)
- Push notifications (PWA not configured)
- Map visualization of traveled routes
- More quest types (weather-based, time-of-day, landmarks)
- Test suite
