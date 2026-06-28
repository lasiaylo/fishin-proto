import { PlayerState } from "../stores/playerStore";

export const CURRENCY_SYMBOL = "࿔";
export const BASE_LURE_ID = "LURE_0";
export const BASE_LURE_NAME = "Worm";

// ==========================================================================
// PLAYER
// ==========================================================================
const INIT_AD = 25;
const CAST_MAX = 40;
export const REEL_MIN = 5;

export const INITIAL_PLAYER_STATE: PlayerState = {
  wallet: 0,
  attack: INIT_AD,
  defense: INIT_AD,
  lineHP: 20,
  inventorySize: 3,
  castMax: CAST_MAX,
  ownedLures: new Set<string>([BASE_LURE_ID]),
  selectedLure: BASE_LURE_ID,
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
// CAST TIMINGS
// ==========================================================================
export const RESULT_DURATION = 500;
export const CAST_MIN = 5;
export const CAST_DURATION_MIN = 0.5;
export const CAST_DURATION_MAX = 1.5;

export const CAST_CHARGE_DURATION = 1250;
export const LURING_REEL_MAX_SPEED = 8;
export const LURE_REEL_SPEED_PER_LEVEL = 1;
export const LURING_REEL_ACCEL = 10;
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
  [Zone.MID]: [20, 60],
  [Zone.FAR]: [60, 90],
};
export const BITE_CHECK_INTERVAL = 1;
export const TARGET_BITE_CHANCE = 0.6;
export const BITE_CHANCE_INCREMENT = 0.1;
export const LURE_BITE_CHANCE_PER_LEVEL = 0.1;

// ==========================================================================
// RARITY
// ==========================================================================
export enum Rarity {
  COMMON = "COMMON",
  UNCOMMON = "UNCOMMON",
  RARE = "RARE",
}

export const RARITY_WEIGHTS: Record<Rarity, number> = {
  [Rarity.COMMON]: 0.6,
  [Rarity.UNCOMMON]: 0.35,
  [Rarity.RARE]: 0.05,
};

export const RARITY_PRICE_MULTIPLIER: Record<Rarity, number> = {
  [Rarity.COMMON]: 1.0,
  [Rarity.UNCOMMON]: 1.5,
  [Rarity.RARE]: 3.0,
};

export const RARITY_STAT_MULTIPLIER: Record<Rarity, number> = {
  [Rarity.COMMON]: 1.0,
  [Rarity.UNCOMMON]: 1.1,
  [Rarity.RARE]: 1.3,
};

export const RARITY_COLOR: Record<Rarity, "gray" | "blue" | "amber"> = {
  [Rarity.COMMON]: "gray",
  [Rarity.UNCOMMON]: "blue",
  [Rarity.RARE]: "amber",
};

// ==========================================================================
// FUNCTIONS
// ==========================================================================
export function computeLureLevel(xp: number): number {
  let level = 0;
  let accumulated = 0;
  for (const req of LURE_LEVEL_XP) {
    accumulated += req;
    if (xp >= accumulated) level++;
    else break;
  }
  return level;
}

export function lureReelMaxSpeed(level: number): number {
  return LURING_REEL_MAX_SPEED + level * LURE_REEL_SPEED_PER_LEVEL;
}

export function applyLureXp(
  currentXp: number,
  gain: number,
): { xp: number; level: number; leveledUp: boolean } {
  const rawXp = currentXp + gain;
  const prevLevel = computeLureLevel(currentXp);
  const newLevel = computeLureLevel(rawXp);
  const leveledUp = newLevel > prevLevel;
  const xp = leveledUp
    ? LURE_LEVEL_XP.slice(0, newLevel).reduce((a, b) => a + b, 0)
    : rawXp;
  return { xp, level: newLevel, leveledUp };
}

export function rollRarity(): Rarity {
  const r = Math.random();
  if (r < RARITY_WEIGHTS[Rarity.RARE]) return Rarity.RARE;
  if (r < RARITY_WEIGHTS[Rarity.RARE] + RARITY_WEIGHTS[Rarity.UNCOMMON])
    return Rarity.UNCOMMON;
  return Rarity.COMMON;
}
