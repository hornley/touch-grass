# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # start dev server at localhost:3000
npm run build    # production build
npm run lint     # eslint check
```

No test suite exists yet.

## Architecture

**TerraQuest** — client-side-only real-world RPG. No API routes. All state lives in `localStorage` under key `terraquest_state`.

### Data flow

```
lib/types.ts       → shared interfaces (GameState, Player, Quest, World, Location)
lib/game.ts        → pure functions: XP, leveling, quest selection, corruption, persistence
lib/useLocation.ts → geolocation hook
components/        → UI components
app/page.tsx       → single page: orchestrates all game state via useState + useEffect
```

### Key mechanics

- **World corruption** grows 10% per 5 minutes of inactivity (`updateWorldState`), reduced by quest completion or moving 100m+
- **XP leveling**: `level = floor(sqrt(xp / 100)) + 1`
- **Quest types**: `travel` (GPS distance), `photo` (camera), `wait` (return after 5 min away)
- **Away XP reward**: minutes offline → XP, base capped at 60 min, overtime doubles rate (`calculateReturnReward`)
- **Quest pool** cycles: completed quest IDs tracked in player state; pool resets when all quests done

### Location simulation (dev/testing)

Pass `?lat=X&lng=Y` query params to bypass real GPS — `useLocation` reads these first. Page auto-detects and shows TEST MODE banner.

### Debug panel

`app/page.tsx` has a hardcoded `if (true)` debug panel with Skip Quest and Reset Game buttons — always visible.

### Git workflow

**Before starting a new feature:**

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

- **Check branch** — run `git branch` before making any changes
- **Always create PR** — never push directly to `master`

### Merge conflict plan

1. Abort bad state: `git merge --abort` or `git rebase --abort`
2. Rebase on latest: `git fetch origin master` then `git rebase origin/master`
3. Resolve conflicts file-by-file, prefer upstream structure and re-apply local changes via patch
4. Verify after each file: `npm run build`
5. Continue without editor: `GIT_EDITOR=true git rebase --continue`

## Stack

Next.js 16, React 19, TypeScript, Tailwind v4 (PostCSS plugin), no external state library.
