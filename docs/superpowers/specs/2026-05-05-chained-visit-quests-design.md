# Chained Visit Quests Design

Date: 2026-05-05
Project: TerraQuest (touch_grass)

## Goals
- Add location-based `visit` quests that target nearby named POIs.
- Introduce chained quests with fixed templates and optional dynamic POI insertion.
- Keep client-only architecture (no backend).
- Respect privacy by filtering private residences.

## Non-Goals
- Server-side verification or moderation.
- Full map UI or turn-by-turn directions.
- Complex object recognition beyond existing capabilities.

## Data Model Changes

### Quest
Add a new quest type and optional fields:

- `type`: add `visit`
- `targetName?: string`
- `targetLat?: number`
- `targetLng?: number`
- `radiusM?: number` (default 50)
- `isCryptic?: boolean`

### Player
Add chain tracking:

```
currentChain: {
  id: string;
  stepIndex: number;
  totalSteps: number;
  type: 'fixed' | 'dynamic';
  multiplier: number;
} | null;
```

## Quest Generation

### Chain Selection
- When a new quest is needed, start a chain with 30% probability.
- If a chain is active, always return the next step in the chain.
- Otherwise, fall back to `QUEST_POOL` selection.

### Chain Templates (Fixed)
- Define template arrays (2–5 steps) like:
  - travel(100m) -> visit(POI) -> photo
  - visit(POI) -> object(tree)
  - travel(500m) -> visit(POI) -> photo -> object

### Dynamic POI Insertion
- At chain step resolution time, insert a `visit` step using nearby POI data.
- If no POIs are available, replace with a non-visit step from a fallback list.

## POI Fetching

### Source
- Use Overpass API (`https://overpass-api.de/api/interpreter`) client-side.

### Query Constraints
- Search within a radius (default 500m).
- Only include named POIs using tags from:
  `tourism`, `historic`, `leisure`, `amenity`, `shop`, `natural`.

### Filtering
- Exclude private/residential areas:
  - `building=residential`, `building=house`, `building=apartments`
  - Any `addr:*` tags

### Caching
- Cache POI results in `localStorage` by rounded lat/lng and radius for 10 minutes.

## Visit Quest Completion

- Required: user within 50m of target AND completes photo capture.
- If `isCryptic` is true, hide the POI name until completion.

## UI/UX

- Add a `visit` badge in the quest card.
- Show distance target (50m) and current proximity if available.
- Show chain progress indicator: `CHAIN 2/3`.
- Add an “Exit Chain” action to abandon the chain and resume random quests.

## Rewards

- Chain quests get a 1.1x chain multiplier, applied on top of level multiplier.
- On chain completion, grant bonus XP (20–50% of chain XP).
- Add `chain_first` achievement for completing any chain.

## Edge Cases

- POI fetch failure: replace `visit` step with a fallback quest.
- Empty POI list: same as above.
- App reload mid-chain: resume from stored `currentChain` state.
- User exits chain: clear chain state and generate a random quest.

## Testing Notes

- Use query params `?lat` / `?lng` to simulate location.
- Verify POI caching by repeated quest generation within 10 minutes.
- Validate cryptic quests hide POI name until completion.
