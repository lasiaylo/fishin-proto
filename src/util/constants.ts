import { PlayerState } from "../stores/playerStore";

export const CURRENCY_SYMBOL = "࿔";

export const MS_IN_SEC = 1000;
export const MS_IN_MIN = MS_IN_SEC * 60;
export const FPS = 60;

export const BASE_LURE_ID = "LURE_0";
export const BASE_LURE_NAME = "Worm";

const INIT_AD = 25;
const CAST_MAX = 60;
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

export const XP_PER_DISTANCE = 10 / CAST_MAX;
export const XP_WIN = 15;
export const XP_LOSS = 0;
export const LURE_LEVEL_XP = [75, 120, 150, 170, 200];

export const LURE_PRICE_MULTIPLIER_INCREMENT = 0.1;

export function lurePriceMultiplier(level: number): number {
  return 1 + level * LURE_PRICE_MULTIPLIER_INCREMENT;
}

export const RESULT_DURATION = 500;
export const CAST_MIN = 5;
export const CAST_DURATION_MIN = 0.5;
export const CAST_DURATION_MAX = 1.5;
export const CAST_CHARGE_DURATION = 1250;
export const LURING_REEL_MAX_SPEED = 10;
export const LURING_REEL_ACCEL = 10;
export const LURING_REEL_DECEL = 20;
export const REEL_MIN = 5;

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

// Bite Chances
export enum Zone {
  CLOSE = "CLOSE",
  MID = "MID",
  FAR = "FAR",
}

export const ZONE_RANGES: Record<Zone, [number, number]> = {
  [Zone.CLOSE]: [20, CAST_MAX],
  [Zone.MID]: [20, CAST_MAX],
  [Zone.FAR]: [50, 80],
};
export const BITE_CHECK_INTERVAL = 1;
export const TARGET_BITE_CHANCE = 0.4;
export const BITE_CHANCE_INCREMENT = 0.1;
