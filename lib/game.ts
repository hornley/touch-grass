import { ChainState, GameState, Quest, QuestHistoryEntry } from './types';

const STORAGE_KEY = 'terraquest_state';

export const ACHIEVEMENTS = [
  { id: 'first_quest',     name: 'First Steps',  icon: '🌱', description: 'Complete your first quest' },
  { id: 'photographer_3',  name: 'Shutter Bug',  icon: '📸', description: 'Complete 3 photo quests' },
  { id: 'photographer_10', name: 'Lens Master',  icon: '🎞️', description: 'Complete 10 photo quests' },
  { id: 'explorer_500m',   name: 'Pathfinder',   icon: '🚶', description: 'Walk 500 meters total' },
  { id: 'explorer_1km',    name: 'Wanderer',     icon: '🗺️', description: 'Walk 1 kilometer total' },
  { id: 'streak_3',        name: 'Committed',    icon: '🔥', description: '3-day streak' },
  { id: 'streak_7',        name: 'Dedicated',    icon: '⚡', description: '7-day streak' },
  { id: 'level_5',         name: 'Veteran',      icon: '⭐', description: 'Reach level 5' },
  { id: 'chain_first',     name: 'Linked Fate',  icon: '⛓️', description: 'Complete your first quest chain' },
];

export const QUEST_POOL: Omit<Quest, 'status' | 'progress'>[] = [
  { id: 'quest_4', type: 'travel', goal: 20,  xpReward: 10, description: 'Walk 20 meters to test movement' },
  { id: 'quest_5', type: 'travel', goal: 100,  xpReward: 20, description: 'Walk 100 meters to explore new territory' },
  { id: 'quest_7', type: 'travel', goal: 1000, xpReward: 50, description: 'Walk 1 kilometer — a true explorer', minLevel: 5 },
  { id: 'quest_8', type: 'meditate', goal: 30, xpReward: 25, description: 'Meditate for 30 seconds' },
  { id: 'quest_9', type: 'meditate', goal: 30, xpReward: 30, description: 'Clear your mind for 30 seconds' },
  { id: 'quest_10', type: 'object', goal: 1, xpReward: 20, description: 'Find a tree or plant', targetObject: 'tree' },
  { id: 'quest_11', type: 'object', goal: 1, xpReward: 20, description: 'Find a cup or bottle', targetObject: 'cup' },
  { id: 'quest_12', type: 'object', goal: 1, xpReward: 20, description: 'Find a book', targetObject: 'book' },
  { id: 'quest_14', type: 'object', goal: 1, xpReward: 25, description: 'Find a person', targetObject: 'person' },
  { id: 'quest_15', type: 'object', goal: 1, xpReward: 25, description: 'Find a cat or dog', targetObject: 'pet' },
];

export type QuestTemplate = Omit<Quest, 'status' | 'progress' | 'id'> & {
  templateId: string;
  requiresPoi?: boolean;
};

export interface ChainTemplate {
  id: string;
  type: 'fixed' | 'dynamic';
  steps: QuestTemplate[];
}

const CHAIN_TEMPLATES: ChainTemplate[] = [
  {
    id: 'chain_explore_1',
    type: 'fixed',
    steps: [
      { templateId: 'travel_100', type: 'travel', goal: 100, xpReward: 20, description: 'Walk 100 meters to attune your compass' },
      { templateId: 'visit_poi', type: 'visit', goal: 1, xpReward: 30, description: 'Visit %POI% and take a photo', requiresPoi: true },
      { templateId: 'photo_chain', type: 'photo', goal: 1, xpReward: 25, description: 'Capture a moment from your journey' },
    ],
  },
  {
    id: 'chain_explore_2',
    type: 'fixed',
    steps: [
      { templateId: 'visit_poi', type: 'visit', goal: 1, xpReward: 30, description: 'Travel to %POI% and capture proof', requiresPoi: true },
      { templateId: 'object_tree', type: 'object', goal: 1, xpReward: 25, description: 'Find a tree or plant nearby', targetObject: 'tree' },
    ],
  },
  {
    id: 'chain_explore_3',
    type: 'fixed',
    steps: [
      { templateId: 'travel_500', type: 'travel', goal: 500, xpReward: 30, description: 'Walk 500 meters to reach the next site' },
      { templateId: 'visit_poi', type: 'visit', goal: 1, xpReward: 35, description: 'Find %POI% and take a photo', requiresPoi: true },
      { templateId: 'object_book', type: 'object', goal: 1, xpReward: 25, description: 'Seek a book or journal', targetObject: 'book' },
    ],
  },
];

const VISIT_RADIUS_M = 50;
const POI_CACHE_MINUTES = 10;

export type PoiResult = {
  name: string;
  lat: number;
  lng: number;
  tags: Record<string, string>;
};

type CachedPois = {
  timestamp: number;
  items: PoiResult[];
};

const POI_TAG_WHITELIST = [
  'tourism',
  'historic',
  'leisure',
  'amenity',
  'shop',
  'natural',
];

const POI_TAG_BLACKLIST: Array<[string, string]> = [
  ['building', 'residential'],
  ['building', 'house'],
  ['building', 'apartments'],
];

function getPoiCacheKey(lat: number, lng: number, radius: number): string {
  const roundedLat = Math.round(lat * 1000) / 1000;
  const roundedLng = Math.round(lng * 1000) / 1000;
  return `terraquest_pois_${roundedLat}_${roundedLng}_${radius}`;
}

function isPoiAllowed(tags: Record<string, string>): boolean {
  if (!tags?.name) return false;
  if (Object.keys(tags).some(key => key.startsWith('addr:'))) return false;
  for (const [key, value] of POI_TAG_BLACKLIST) {
    if (tags[key] === value) return false;
  }
  return POI_TAG_WHITELIST.some(key => Boolean(tags[key]));
}

function formatPoiResults(elements: Array<{ tags?: Record<string, string>; lat?: number; lon?: number; center?: { lat: number; lon: number } }>): PoiResult[] {
  return elements
    .map(el => {
      const tags = el.tags || {};
      const lat = el.lat ?? el.center?.lat;
      const lng = el.lon ?? el.center?.lon;
      return {
        name: tags.name as string,
        lat,
        lng,
        tags,
      };
    })
    .filter((poi): poi is PoiResult => typeof poi.lat === 'number' && typeof poi.lng === 'number')
    .filter(poi => isPoiAllowed(poi.tags));
}

export async function fetchNearbyPois(lat: number, lng: number, radius: number = 500): Promise<PoiResult[]> {
  if (typeof window === 'undefined') return [];
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];
  const cacheKey = getPoiCacheKey(lat, lng, radius);
  const cachedRaw = localStorage.getItem(cacheKey);
  if (cachedRaw) {
    try {
      const cached: CachedPois = JSON.parse(cachedRaw);
      if (Date.now() - cached.timestamp < POI_CACHE_MINUTES * 60000) {
        return cached.items;
      }
    } catch {
      localStorage.removeItem(cacheKey);
    }
  }

  const tagFilters = POI_TAG_WHITELIST.map(tag => `nwr(around:${radius},${lat},${lng})[${tag}];`).join('');
  const query = `[
    out:json][timeout:25];
    (${tagFilters});
    out center tags;
  `;

  try {
    const response = await fetch('https://osm.hpi.de/overpass/api/interpreter', {
      method: 'POST',
      body: query,
    });
    if (!response.ok) return [];
    const data = await response.json();
    const items = formatPoiResults(data.elements ?? []);
    const cache: CachedPois = { timestamp: Date.now(), items };
    localStorage.setItem(cacheKey, JSON.stringify(cache));
    return items;
  } catch {
    return [];
  }
}

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function makeQuestId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}

function buildVisitQuest(template: QuestTemplate, poi: PoiResult, isCryptic: boolean): Quest {
  const description = template.description.replace('%POI%', isCryptic ? 'a nearby landmark' : poi.name);
  return {
    id: makeQuestId('visit'),
    type: 'visit',
    status: 'active',
    progress: 0,
    goal: 1,
    xpReward: template.xpReward,
    description,
    targetName: poi.name,
    targetLat: poi.lat,
    targetLng: poi.lng,
    radiusM: VISIT_RADIUS_M,
    isCryptic,
  };
}

function buildQuestFromTemplate(template: QuestTemplate): Quest {
  const { templateId, ...rest } = template;
  return {
    id: makeQuestId(templateId),
    status: 'active',
    progress: 0,
    ...rest,
  };
}

function getFallbackQuest(): Quest {
  const fallback = QUEST_POOL.filter(q => q.type !== 'travel');
  const selected = pickRandom(fallback.length ? fallback : QUEST_POOL);
  return {
    ...selected,
    status: 'active',
    progress: 0,
  };
}

function getChainTemplate(): ChainTemplate {
  return pickRandom(CHAIN_TEMPLATES);
}

export function startChain(): ChainState {
  const template = getChainTemplate();
  return {
    id: template.id,
    stepIndex: 0,
    totalSteps: template.steps.length,
    type: template.type,
    multiplier: 1.1,
    xpEarned: 0,
  };
}

export function getNextQuest(
  completedIds: string[],
  level: number,
  chain: ChainState | null,
  location: { lat: number; lng: number } | null,
  pois: PoiResult[] = [],
): { quest: Quest; chain: ChainState | null }
 {
  let nextChain = chain;
  if (!nextChain && Math.random() < 0.3) {
    nextChain = startChain();
  }

  if (!nextChain) {
    return { quest: getRandomQuest(completedIds, level), chain: null };
  }

  const template = CHAIN_TEMPLATES.find(t => t.id === nextChain?.id);
  if (!template) {
    return { quest: getRandomQuest(completedIds, level), chain: null };
  }

  const step = template.steps[nextChain.stepIndex];
  if (step.requiresPoi) {
    if (!location) return { quest: getFallbackQuest(), chain: nextChain };
    if (!pois.length) return { quest: getFallbackQuest(), chain: nextChain };
    const poi = pickRandom(pois);
    const isCryptic = Math.random() < 0.2;
    return { quest: buildVisitQuest(step, poi, isCryptic), chain: nextChain };
  }

  return { quest: buildQuestFromTemplate(step), chain: nextChain };
}

export function getInitialState(): GameState {
  return {
    player: {
      xp: 0,
      level: 1,
      lastLocation: null,
      lastActive: Date.now(),
      completedQuests: [],
      questHistory: [],
      streak: 0,
      lastStreakDate: null,
      totalDistance: 0,
      achievements: [],
      photoQuestsCompleted: 0,
      currentChain: null,
      chainCompletions: 0,
    },
    currentQuest: null,
    lastAway: null,
    sessions: [],
    currentSession: null,
  };
}

export function loadGameState(): GameState {
  if (typeof window === 'undefined') return getInitialState();
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return getInitialState();
  try {
    const parsed = JSON.parse(stored);
    if (parsed.world) {
      delete parsed.world;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
      } catch {
        // Ignore storage write failures during migration and keep the parsed state.
      }
    }
    if (!parsed.player?.questHistory) {
      parsed.player = parsed.player ?? {};
      parsed.player.questHistory = [];
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
      } catch {
        // Ignore storage write failures during migration and keep the parsed state.
      }
    }
    return parsed;
  } catch {
    return getInitialState();
  }
}

export function saveGameState(state: GameState): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function calculateLevel(xp: number): number {
  return Math.floor(Math.sqrt(xp / 100)) + 1;
}

export function getXpForNextLevel(level: number): number {
  return Math.pow(level, 2) * 100;
}

export function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function getQuestXpMultiplier(level: number): number {
  if (level >= 7) return 1.5;
  if (level >= 3) return 1.2;
  return 1.0;
}

export function getRandomQuest(completedIds: string[], level: number = 1): Quest {
  const available = QUEST_POOL.filter(q => !completedIds.includes(q.id) && (q.minLevel ?? 1) <= level);
  const pool = available.length > 0 ? available : QUEST_POOL.filter(q => (q.minLevel ?? 1) <= level);
  const selected = pool[Math.floor(Math.random() * pool.length)];
  return {
    ...selected,
    status: 'active',
    progress: 0,
  };
}

export function updateStreak(
  lastStreakDate: string | null,
  currentStreak: number,
): { streak: number; lastStreakDate: string } {
  const today = new Date().toISOString().slice(0, 10);
  if (lastStreakDate === today) {
    return { streak: currentStreak, lastStreakDate: today };
  }
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (lastStreakDate === yesterday) {
    return { streak: currentStreak + 1, lastStreakDate: today };
  }
  return { streak: 1, lastStreakDate: today };
}

export function checkNewAchievements(state: GameState): string[] {
  const { player } = state;
  const already = new Set(player.achievements);
  const unlocked: string[] = [];

  const check = (id: string, condition: boolean) => {
    if (!already.has(id) && condition) unlocked.push(id);
  };

  check('first_quest',     player.completedQuests.length >= 1);
  check('photographer_3',  player.photoQuestsCompleted >= 3);
  check('photographer_10', player.photoQuestsCompleted >= 10);
  check('explorer_500m',   player.totalDistance >= 500);
  check('explorer_1km',    player.totalDistance >= 1000);
  check('streak_3',        player.streak >= 3);
  check('streak_7',        player.streak >= 7);
  check('level_5',         player.level >= 5);
  check('chain_first',     player.chainCompletions >= 1);

  return unlocked;
}

export function calculateReturnReward(lastAway: number | null): { minutes: number; xp: number } {
  if (!lastAway) return { minutes: 0, xp: 0 };
  const diffMs = Date.now() - lastAway;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 2) return { minutes: 0, xp: 0 };
  const baseMinutes = Math.min(minutes, 60);
  const overtime = Math.max(0, minutes - 60);
  const xp = baseMinutes + overtime * 2;
  return { minutes, xp };
}

const MAX_QUEST_HISTORY = 100;

export function addQuestToHistory(
  history: QuestHistoryEntry[],
  entry: QuestHistoryEntry,
): QuestHistoryEntry[] {
  const updated = [...history, entry];
  if (updated.length > MAX_QUEST_HISTORY) {
    return updated.slice(-MAX_QUEST_HISTORY);
  }
  return updated;
}
