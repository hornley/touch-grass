# AGENT.md — Context for AI Agents

Quick-start guide for AI agents working on TerraQuest. Read this + `CLAUDE.md` + `docs/PRD.md` before making changes.

---

## Project in one sentence

Client-side-only real-world RPG where physical movement heals a fantasy world from corruption. No backend. No auth. All state in `localStorage`.

## Commands

```bash
npm run dev    # hot reload dev server at localhost:3000
npm run build  # type check + production build
npm run lint   # eslint
```

---

## Key constraints

- **No API routes** — this is a pure frontend app. Do not add server-side logic.
- **No external state library** — useState + useEffect only.
- **Single localStorage key** — all game state under `terraquest_state`. Adding new fields requires backfilling defaults for existing saves (see how `loaded.player.totalDistance ?? 0` is handled in `page.tsx` load effect).
- **No test suite yet** — lint + build are the only CI checks.
- **Geolocation requires HTTPS** — works on localhost and Tailscale serve. Fails silently on plain HTTP. Use `?lat=X&lng=Y` query params to simulate GPS in dev.
- **Debug panel always visible** — `if (true)` block in `app/page.tsx`. Intentional for hackathon.

---

## Git workflow

### Before starting a new feature

Always sync with remote before creating a feature branch:

```bash
git checkout master
git pull --rebase
git checkout -b feature/your-feature-name
```

If you have uncommitted changes, stash them first:

```bash
git stash
git checkout master && git pull --rebase
git checkout -b feature/your-feature-name
git stash pop
```

### Ongoing work

- **Check branch** — run `git branch` before making changes
- **Always create PR** — never push directly to `master`

---

## Data flow

```
lib/types.ts       — interfaces only, no logic
lib/game.ts        — pure functions, no React, no side effects
lib/useLocation.ts — geolocation hook (reads ?lat/lng params first)
app/page.tsx       — ALL game state lives here via useState
components/        — presentational only, receive props
```

`app/page.tsx` is the single source of truth. It owns `gameState`, calls `saveGameState` after every mutation, and wires all handlers. Components do not mutate state directly.

---

## State mutation pattern

Every state update follows this pattern:

```ts
setGameState(prev => {
  if (!prev) return prev;
  const newState = { ...prev, /* changes */ };
  saveGameState(newState);
  return newState;
});
```

Always call `saveGameState` inside the updater. Never mutate `prev` directly.

---

## Adding a new field to GameState / Player

1. Add to interface in `lib/types.ts`
2. Add default to `getInitialState()` in `lib/game.ts`
3. Backfill in the load `useEffect` in `app/page.tsx`:
   ```ts
   fieldName: loaded.player.fieldName ?? defaultValue,
   ```

---

## Adding a new quest type

1. Add type literal to `Quest.type` in `lib/types.ts`
2. Add entries to `QUEST_POOL` in `lib/game.ts`
3. Handle the new type in `app/page.tsx` (location effect + quest card render)
4. Add quest type badge in `questBadge` map in `app/page.tsx`

---

## Adding a new achievement

1. Add entry to `ACHIEVEMENTS` array in `lib/game.ts`
2. Add check condition in `checkNewAchievements()` in `lib/game.ts`
3. No UI changes needed — `AchievementsTab` renders all `ACHIEVEMENTS` automatically

---

## Design system

- **Fonts**: Cinzel (`var(--font-cinzel)`) for all headings/labels, Inconsolata (`var(--font-inconsolata)`) for body/data
- **Amber accent**: `#d4a030` — use for primary interactive elements, level display, XP
- **Cards**: use `className="rune-panel"` — dark background, amber-tinted gradient, border
- **Section headers**: use `<SectionHeader label="..." />` component defined in `page.tsx`
- **Animations**: defined in `globals.css` as `.animate-*` classes
- All complex visual effects use inline `style` props (not Tailwind) for reliability with Tailwind v4

---

## Gotchas

- `getXpForNextLevel(level)` returns **total** XP for next level, not delta. XP progress within current level needs `(xp - (level-1)² * 100) / (nextLevelXp - currentLevelXp)`.
- `getRandomQuest` takes a `level` param — always pass `player.level` so level-gated quests work correctly.
- `useLocation` only fires `requestLocation` automatically when `enabled=true`. GPS is off by default until player clicks "Begin Journey".
- Session tracking: `currentSession` is cleared to `null` on visibility hidden, recreated on visible. Check for null before incrementing.
- `checkNewAchievements` returns only **newly** unlocked IDs (not already in `player.achievements`). Call after every state mutation that could trigger one, then merge result into `player.achievements`.