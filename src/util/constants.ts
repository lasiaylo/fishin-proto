import { PlayerState } from "../stores/playerStore";

export const CURRENCY_SYMBOL = "࿔";
export const BASE_LURE_ID = "LURE_0";
export const BASE_LURE_NAME = "Worm";

const INIT_AD = 25;
const CAST_MAX = 40;
export const REEL_MIN = 5;

export const INITIAL_PLAYER_STATE: PlayerState = {
  wallet: 0,
  attack: INIT_AD,
  defense: INIT_AD,
  lineHP: 15,
  inventorySize: 3,
  castMax: CAST_MAX,
  ownedLures: new Set<string>([BASE_LURE_ID]),
  selectedLure: BASE_LURE_ID,
  inventory: [],
};

export const XP_PER_DISTANCE = 10 / CAST_MAX;
export const XP_WIN = 15;
export const XP_LOSS = 0;
export const LURE_LEVEL_XP = [75, 120, 150, 170, 200];

export const LURE_PRICE_MULTIPLIER_INCREMENT = 0.0;

export function lurePriceMultiplier(level: number): number {
  return 1 + level * LURE_PRICE_MULTIPLIER_INCREMENT;
}

export function lureReelMaxSpeedMultiplier(level: number): number {
  return 1 + level * LURE_REEL_SPEED_MULTIPLIER_INCREMENT;
}

export const RESULT_DURATION = 500;
export const CAST_MIN = 5;
export const CAST_DURATION_MIN = 0.5;
export const CAST_DURATION_MAX = 1.5;

export const CAST_CHARGE_DURATION = 1250;
export const LURING_REEL_MAX_SPEED = 8;
export const LURING_REEL_ACCEL = 10;
export const LURING_REEL_DECEL = 20;
export const LURE_REEL_SPEED_MULTIPLIER_INCREMENT = 0.2;

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

// Rarity
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

export function rollRarity(): Rarity {
  const r = Math.random();
  if (r < RARITY_WEIGHTS[Rarity.RARE]) return Rarity.RARE;
  if (r < RARITY_WEIGHTS[Rarity.RARE] + RARITY_WEIGHTS[Rarity.UNCOMMON])
    return Rarity.UNCOMMON;
  return Rarity.COMMON;
}

// Bite Chances
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
export const TARGET_BITE_CHANCE = 0.4;
export const BITE_CHANCE_INCREMENT = 0.1;
