<div align="center">

# TerraQuest

> A real-world RPG where your movement heals the realm.

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js) ![React](https://img.shields.io/badge/React-19-61DAFB?logo=react) ![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript) ![Tailwind](https://img.shields.io/badge/Tailwind-v4-06B6D4?logo=tailwindcss) ![PWA](https://img.shields.io/badge/PWA-ready-5A0FC8) ![License](https://img.shields.io/badge/License-MIT-green)

</div>

---

## Problem

Most fitness apps track your movement but give you nothing back. There's no world at stake, no narrative, no consequence for staying on the couch.

- **No motivation loop** — steps counted, nothing changes
- **No story** — data without meaning doesn't pull you outside
- **No consequence** — skipping a day costs nothing
- **No reward for offline time** — being away from your phone goes unacknowledged

---

## Solution

TerraQuest ties your real-world GPS, camera, and time to a living fantasy realm that decays without you. Move through the physical world to heal it.

- Walk required distances → reduce world corruption
- Take photos in the real world → complete camera quests
- Stay offline and return → earn XP for time spent away
- Every action is local — no account, no server, no friction

---

## Advanced Features

- **World Corruption engine** — passive state machine: `stable` (0–49%) → `warning` (50–79%) → `corrupted` (80–100%), grows +10% per 5 min of inactivity
- **Away-XP reward** — 1 XP/min offline, capped at 60 min; overtime (>60 min) earns 2 XP/min
- **XP multiplier scaling** — 1.0× default → 1.2× at level 3 → 1.5× at level 7
- **Location simulation** — append `?lat=X&lng=Y` to the URL to bypass real GPS in dev; page shows TEST MODE banner
- **Pose + object detection** — MediaPipe hooks wired for future quest types that verify physical actions via camera

---

## Core Features

### REALM — Main Game

- Active quest with live progress bar
- World corruption gauge, color-reactive (green → amber → red)
- Live GPS coordinates display
- Player card: rank in Roman numerals, 10-segment XP bar, daily streak counter

### CODEX — Stats

- Quest breakdown by type (travel / photo / wait)
- Total distance walked across all sessions
- Session history log

### MARKS — Achievements

9 badge achievements (locked/unlocked grid):

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

## Quest Types

| Type | Trigger | How to complete |
|------|---------|-----------------|
| `travel` | GPS distance | Walk the required meters |
| `photo` | Camera | Take or upload a photo |
| `wait` | Time | Leave the app for 5+ min, then return |
| `meditate` | Time + stillness | Stay near your start location |
| `object` | Camera + ML | Find a target object via ObjectDetection |

Quest pool cycles — resets when all quests are completed. Level 5+ unlocks a harder 1km travel quest (50 XP).

---

## App Flow

1. **Open app** → a quest is assigned based on your level
2. **Complete real-world action** — walk, photograph, wait, or find an object
3. **Quest complete** → XP earned, world corruption reduced
4. **Go idle** → corruption grows +10% every 5 minutes
5. **Return after being away** → away-XP reward calculated on re-open
6. **Level up** → XP multiplier increases, harder quests become available

---

## Next Phase

- Push notifications via PWA service worker
- Map visualization of traveled routes
- Multiplayer and leaderboards (requires backend + auth)
- Weather-based and time-of-day quest types
- Test suite

---

## Local Setup

```bash
git clone <repo-url>
cd touch-grass
npm install
npm run dev      # http://localhost:3000
```

**GPS simulation** — no need to go outside while developing:

```
http://localhost:3000?lat=14.5995&lng=120.9842
```

**Debug panel** — always visible in all environments. Use **Skip Quest** to advance through the quest pool or **Reset Game** to wipe `localStorage` state.

```bash
npm run build    # production build
npm run lint     # eslint check
```

## Deploy (Azure Static Web Apps)

Production URL:

`https://ashy-stone-078346700.7.azurestaticapps.net`

This project is configured to deploy as a static Next.js export (`out/`) using GitHub Actions via [.github/workflows/azure-static-web-apps.yml](.github/workflows/azure-static-web-apps.yml).

If you are not a repo owner:

- You can push code and open PRs, but you usually cannot create repo secrets.
- Ask a repo admin to add `AZURE_STATIC_WEB_APPS_API_TOKEN` in repository secrets.
- Once merged to `master`, deployment runs automatically.

If you need to deploy without repo-secret access, ask an owner for a one-time deployment token from the Azure Static Web App and deploy from your machine with Azure Static Web Apps CLI.
