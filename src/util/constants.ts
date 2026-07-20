import { PlayerState } from "../stores/playerStore";

export const CURRENCY_SYMBOL = "࿔";
export const DREAM_POINT_SYMBOL = "✦";
export const LOCK_SYMBOL = "🔒";
export const FRIEND_NPC_NAME = "big ghost";
export const NPC_ACTIVITY_DUMMY = "watching their line";
export const GIFT_COOLDOWN_MS = 4 * 60 * 1000;
export const BASE_FISH_ID = "FISH_B_0";
export const BASE_LURE_NAME = "Worm";
export const BASE_BAIT_ID = "BAIT_0";
export const BASE_BAIT_NAME = "Worm";
export const BAIT_ID_PREFIX = "BAIT_";
export const BAIT_MAX_STACK = 10;
export const BAIT_START_COUNT = 10;

// ==========================================================================
// PLAYER
// ==========================================================================
export const CAST_MAX = 30;
export const REEL_MIN = 5;

export interface Rod {
  id: string;
  attackLevel: number;
  defenseLevel: number;
  lineHpLevel: number;
}

export const INITIAL_PLAYER_STATE: PlayerState = {
  wallet: 0,
  inventorySize: 4,
  incomeBoostPercent: 0,
  ownedLures: new Set<string>(),
  baitInventory: { [BASE_BAIT_ID]: BAIT_START_COUNT },
  ownedRods: [{ id: "ROD_1", attackLevel: 0, defenseLevel: 0, lineHpLevel: 0 }],
  rodSlotAssignments: [null],
  rodSlotItems: [null],
  inventory: [],
};

// ==========================================================================
// XP
// ==========================================================================
export const XP_PER_DISTANCE = 10 / CAST_MAX;
export const XP_WIN = 15;
export const XP_LOSS = 0;
const START_XP = 50;
const XP_GROWTH = 1.2;
export const LURE_LEVEL_XP = Array(5)
  .fill(START_XP)
  .map((n, i) => Math.ceil(n * XP_GROWTH ** i));

// ==========================================================================
// DREAM POINTS
// ==========================================================================
const START_DREAM_MONEY = 100;
const DREAM_MONEY_GROWTH = 2;
export const DREAM_POINT_MONEY_THRESHOLDS = Array(10)
  .fill(START_DREAM_MONEY)
  .map((n, i) => Math.ceil(n * DREAM_MONEY_GROWTH ** i));

// ==========================================================================
// CAST TIMINGS
// ==========================================================================
export const RESULT_DURATION = 500;
export const CAST_MIN = 5;
export const CAST_DURATION_MIN = 0.5;
export const CAST_DURATION_MAX = 1.5;

export const CAST_CHARGE_DURATION = 1000;

export const LURING_REEL_ACCEL = 20;
export const LURING_REEL_DECEL = 20;

// ==========================================================================
// BITE CHANCES
// ==========================================================================
export enum Zone {
  CLOSE = "CLOSE",
  MID = "MID",
  FAR = "FAR",
}

export const ZONE_RANGES: Record<Zone, [number, number]> = {
  [Zone.CLOSE]: [5, CAST_MAX],
  [Zone.MID]: [5, 60],
  [Zone.FAR]: [60, 90],
};
export const BITE_CHECK_INTERVAL = 1;
export const TARGET_BITE_CHANCE = 0.4;
export const BITE_CHANCE_INCREMENT = 0.1;
export const LURE_BITE_CHANCE_PER_LEVEL = 0.0;

// ==========================================================================
// TACKLE
// ==========================================================================
export enum TackleType {
  BAIT = "BAIT",
  LURE = "LURE",
}

export function getTackleType(lureId: string): TackleType {
  return lureId.startsWith(BAIT_ID_PREFIX) ? TackleType.BAIT : TackleType.LURE;
}

export function getTackleDirections(lureId: string): string {
  return lureId.startsWith(BAIT_ID_PREFIX)
    ? "method: wait"
    : "method: retrieve";
}

// ==========================================================================
// RARITY
// ==========================================================================
export enum Rarity {
  COMMON = "COMMON",
  UNCOMMON = "UNCOMMON",
  RARE = "RARE",
  LEGENDARY = "LEGENDARY",
}

export const RARITY_WEIGHTS: Record<Rarity, number> = {
  [Rarity.COMMON]: 0.65,
  [Rarity.UNCOMMON]: 0.25,
  [Rarity.RARE]: 0.14,
  [Rarity.LEGENDARY]: 0.01,
};

export const RARITY_PRICE_MULTIPLIER: Record<Rarity, number> = {
  [Rarity.COMMON]: 1.0,
  [Rarity.UNCOMMON]: 1.25,
  [Rarity.RARE]: 3,
  [Rarity.LEGENDARY]: 15,
};

export const RARITY_STAT_MULTIPLIER: Record<Rarity, number> = {
  [Rarity.COMMON]: 1.0,
  [Rarity.UNCOMMON]: 1.01,
  [Rarity.RARE]: 1.02,
  [Rarity.LEGENDARY]: 1.05,
};

export const RARITY_COLOR: Record<Rarity, "gray" | "green" | "blue" | "amber"> =
  {
    [Rarity.COMMON]: "gray",
    [Rarity.UNCOMMON]: "blue",
    [Rarity.RARE]: "amber",
    [Rarity.LEGENDARY]: "amber",
  };

// BASE_FISH_ID never rolls rarity in-game, so it's the only fish whose
// price/stats aren't blended across the rarity distribution.
export function fishRarities(fishId: string): Rarity[] {
  return fishId === BASE_FISH_ID
    ? [Rarity.COMMON]
    : (Object.values(Rarity) as Rarity[]);
}

export function rarityExpectedPriceMultiplier(fishId: string): number {
  const rarities = fishRarities(fishId);
  const totalWeight = rarities.reduce((s, r) => s + RARITY_WEIGHTS[r], 0);
  return rarities.reduce(
    (s, r) =>
      s + (RARITY_WEIGHTS[r] / totalWeight) * RARITY_PRICE_MULTIPLIER[r],
    0,
  );
}

// ==========================================================================
// FUNCTIONS
// ==========================================================================
export function computeLevelFromThresholds(
  thresholds: number[],
  value: number,
): number {
  let level = 0;
  let accumulated = 0;
  for (const req of thresholds) {
    accumulated += req;
    if (value >= accumulated) level++;
    else break;
  }
  return level;
}

export function applyThresholdGain(
  thresholds: number[],
  current: number,
  gain: number,
): { value: number; level: number; leveledUp: boolean } {
  const rawValue = current + gain;
  const prevLevel = computeLevelFromThresholds(thresholds, current);
  const newLevel = computeLevelFromThresholds(thresholds, rawValue);
  const leveledUp = newLevel > prevLevel;
  const value = leveledUp
    ? thresholds.slice(0, newLevel).reduce((a, b) => a + b, 0)
    : rawValue;
  return { value, level: newLevel, leveledUp };
}

export function computeLureLevel(xp: number): number {
  return computeLevelFromThresholds(LURE_LEVEL_XP, xp);
}

export function applyLureXp(
  currentXp: number,
  gain: number,
): { xp: number; level: number; leveledUp: boolean } {
  const { value, level, leveledUp } = applyThresholdGain(
    LURE_LEVEL_XP,
    currentXp,
    gain,
  );
  return { xp: value, level, leveledUp };
}

export function computeDreamPoints(cumulativeMoneyEarned: number): number {
  return computeLevelFromThresholds(
    DREAM_POINT_MONEY_THRESHOLDS,
    cumulativeMoneyEarned,
  );
}

export interface ThresholdProgress {
  current: number; // progress into the current bracket
  next: number; // size of the next bracket (0 once maxed)
  fraction: number; // current / next, capped at 1 once maxed
}

export function computeDreamPointsProgress(
  cumulativeMoneyEarned: number,
): ThresholdProgress {
  const level = computeDreamPoints(cumulativeMoneyEarned);
  const floor = DREAM_POINT_MONEY_THRESHOLDS.slice(0, level).reduce(
    (a, b) => a + b,
    0,
  );
  const next = DREAM_POINT_MONEY_THRESHOLDS[level] ?? null;
  if (next === null) return { current: 0, next: 0, fraction: 1 };
  const current = cumulativeMoneyEarned - floor;
  return { current, next, fraction: current / next };
}

export function rollRarity(): Rarity {
  const r = Math.random();
  if (r < RARITY_WEIGHTS[Rarity.LEGENDARY]) return Rarity.LEGENDARY;
  if (r < RARITY_WEIGHTS[Rarity.LEGENDARY] + RARITY_WEIGHTS[Rarity.RARE])
    return Rarity.RARE;
  if (
    r <
    RARITY_WEIGHTS[Rarity.LEGENDARY] +
      RARITY_WEIGHTS[Rarity.RARE] +
      RARITY_WEIGHTS[Rarity.UNCOMMON]
  )
    return Rarity.UNCOMMON;
  return Rarity.COMMON;
}
