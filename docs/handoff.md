# TerraQuest - AI Agent Handoff Document

## Project Context

TerraQuest is a client-side real-world RPG built as a mobile web app on Next.js. Physical movement heals a fantasy world from corruption.

**Repo:** `https://github.com/hornley/touch-grass`
**Main branch:** `master`
**Feature branch:** `feature/leaderboards-multiplayer-presence` (PR #68 - ready to merge once Functions are up)

---

## What Was Built

### PR #68 — Leaderboards + Multiplayer Presence (committed, PR open)

**Components added:**

- `lib/db.ts` — MongoDB connection singleton (Azure Cosmos DB with MongoDB API)
- `app/api/` — 4 Next.js API routes (player CRUD, presence, leaderboard)
  - `app/api/players/route.ts` — POST (upsert) + GET
  - `app/api/players/[id]/route.ts` — GET + PATCH
  - `app/api/presence/route.ts` — GET (nearby) + POST (heartbeat)
  - `app/api/leaderboard/route.ts` — GET (sorted leaderboard)
- `components/LeaderboardTab.tsx` — new tab with quests completed + level leaderboards + nearby players
- `components/BottomNav.tsx` — added RIVALS tab (⚔ icon)
- `app/page.tsx` — migration logic (sync localStorage players to MongoDB on load), username input on welcome screen, username setup modal for existing players without a name
- `lib/types.ts` — added `playerId` and `username` to Player interface
- `lib/game.ts` — added defaults for new player fields
- `next.config.ts` — removed `output: "export"` to enable server-side rendering

**Credentials:**
- MongoDB: `mongodb+srv://terraadmin:FindingNemo%401@terraquest-cluster.global.mongocluster.cosmos.azure.com/?tls=true&authMechanism=SCRAM-SHA-256`
- DB name: `terraquest`
- Collection: `players`

---

## Current Architecture

```
Frontend (Azure Static Web Apps)
  └── Next.js static site — serves HTML/JS only, no server code
       └── Calls /api/* → DOES NOT WORK on deployed site

Local Dev (ngrok)
  └── Next.js dev server → API routes work locally
       └── Calls MongoDB Atlas → Works for everyone on ngrok

Azure Function App: terraquest
  └── https://terraquest.azurewebsites.net
       └── No functions created yet — THIS IS THE GAP
```

---

## Gap: API Routes Don't Work in Production

The deployed Azure Static Web Apps serves static files only. The Next.js API routes never execute.

**Solution:** Create Azure Functions to handle the backend API.

---

## What Needs To Be Done

### 1. Create 4 Azure Functions (via Azure Portal or CLI)

All use the same MongoDB connection string:
`MONGODB_URI=mongodb+srv://terraadmin:FindingNemo%401@terraquest-cluster.global.mongocluster.cosmos.azure.com/?tls=true&authMechanism=SCRAM-SHA-256&retrywrites=false&maxIdleTimeMS=120000`

All need CORS headers: `Access-Control-Allow-Origin: *`

#### Function 1: `players`
- **HTTP Trigger**
- **Route:** `players`
- **Methods:** GET, POST
- **GET:** Returns all players sorted by questsCompleted desc, level desc (limit param supported)
- **POST:** Upserts player — if playerId provided and exists, update; if playerId provided but not found, create; if no playerId, create new. Returns `{playerId, username, isNew}`

#### Function 2: `players-by-id`
- **HTTP Trigger**
- **Route:** `players-by-id`
- **Methods:** GET, PATCH
- **GET:** Returns single player by playerId (query param `id`)
- **PATCH:** Updates player fields (username, level, xp, questsCompleted, totalDistance, achievements, lastLocation, lastActive)

#### Function 3: `presence`
- **HTTP Trigger**
- **Route:** `presence`
- **Methods:** GET, POST
- **GET:** Query params `lat`, `lng`, `radius` (default 500, max 2000). Returns nearby players (within radius) sorted by distance. Each entry includes `playerId`, `username`, `level`, `lastLocation`, `distanceM`
- **POST:** Body: `{playerId, username, lat, lng}`. Updates player's location. Returns `{ok: true}` or 404 if player not found

#### Function 4: `leaderboard`
- **HTTP Trigger**
- **Route:** `leaderboard`
- **Methods:** GET
- **GET:** Query params `type` (quests|level|distance), `limit` (default 100). Returns ranked leaderboard with `rank`, `playerId`, `username`, `level`, `xp`, `questsCompleted`, `totalDistance`

**Haversine formula** needed for presence (JavaScript):
```javascript
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
```

### 2. Add Environment Variables to Function App

In Azure Portal → Function Apps → **terraquest** → Configuration → Application settings:
- `MONGODB_URI` = `mongodb+srv://terraadmin:FindingNemo%401@terraquest-cluster.global.mongocluster.cosmos.azure.com/?tls=true&authMechanism=SCRAM-SHA-256&retrywrites=false&maxIdleTimeMS=120000`
- `MONGODB_DB` = `terraquest`

### 3. Update Frontend to Call Azure Functions (not Next.js API routes)

**File:** `app/page.tsx` — find all `fetch('/api/...` calls and change to `https://terraquest.azurewebsites.net/api/...`

**File:** `components/LeaderboardTab.tsx` — same pattern

**Better approach:** Set base URL in `lib/api.ts`:
```typescript
// lib/api.ts
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3000/api';

export const api = {
  players: (body: object) => fetch(`${API_BASE}/players`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body) }),
  // etc
};
```

Then set `NEXT_PUBLIC_API_BASE=https://terraquest.azurewebsites.net/api` in `.env.local` for local dev (calls Functions via ngrok tunnel) AND as an Azure App Setting.

### 4. Optional: Add MONGODB_URI to Azure Static Web Apps

Not strictly needed since the frontend calls Azure Functions directly, not the Next.js app.

### 5. Test End-to-End

1. Test Functions individually via Azure Portal Test panel
2. Test from frontend on local dev (with ngrok for the Function URLs)
3. Verify leaderboard loads, presence works, player data syncs

---

## File Locations

| File | Purpose |
|------|---------|
| `lib/db.ts` | MongoDB connection (reference, will be replaced by Functions) |
| `lib/types.ts` | Player type with `playerId` and `username` |
| `app/page.tsx` | Main game page, migration logic, username prompts |
| `components/LeaderboardTab.tsx` | Leaderboards UI (quests + level tabs, nearby players list) |
| `components/BottomNav.tsx` | Navigation with RIVALS tab |
| `.env.local` | `MONGODB_URI` (gitignored, for local dev) |
| `app/api/` | Next.js API routes (work locally only) |

## Commands

```bash
npm run dev     # Start local dev server
npm run build   # Production build (type check + build)
npm run lint    # ESLint
```

## Existing Issues

- `output: "export"` was removed from `next.config.ts` — Azure Static Web Apps CI/CD may need the workflow updated
- The `out/` folder is still present from the old static export — can be cleaned up
- Lint has pre-existing warnings in `TravelMap.tsx` (missing useEffect deps) and `page.tsx` — these are not new

## PR Status

- **PR #68** — `feature/leaderboards-multiplayer-presence` → `master`
- Build passes, lint passes
- Merge is blocked by: Azure Functions not yet created
- Once Functions exist + frontend updated to call them → safe to merge and deploy

---

## Quick-Start: Creating Azure Functions via Azure Portal

### Step-by-step

1. Go to https://portal.azure.com → Function Apps → **terraquest**
2. Click **Functions** in the left nav
3. Click **+ Create**
4. Select **HTTP trigger** template
5. Name it `players`, leave Authorization level: **Function**
6. Click Create
7. Go to **Code + Test** → replace the default `index.js` with the code below → Save
8. Click **Integration** → **HTTP (req)** → change Route from `{route}` to `players` → Save
9. Repeat for the other 3 functions: `players-by-id`, `presence`, `leaderboard`

### Authorization levels
- Use **Function** level for all (requires an API key in the URL)
- After creating, get the function key from: Function → **Keys** → show function key
- URL format: `https://terraquest.azurewebsites.net/api/players?code=YOUR_KEY`

### If using Anonymous (simpler for now)
- Authorization level: **Anonymous** → no API key needed
- URL: `https://terraquest.azurewebsites.net/api/players`
- CORS must be enabled in Function App settings

### Enable CORS on Function App
Azure Portal → terraquest → **CORS** → add `*` or your deployed site URL → Save

