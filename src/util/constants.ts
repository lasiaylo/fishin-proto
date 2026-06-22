export const MS_IN_SEC = 1000;
export const MS_IN_MIN = MS_IN_SEC * 60;
export const FPS = 60;

export const BASE_LURE_ID = "LURE_0";
export const BASE_LURE_NAME = "Worm";

export const XP_PER_DISTANCE = 1;
export const XP_WIN = 30;
export const XP_LOSS = 10;
// XP required to advance from each level to the next (index 0 = level 0→1, etc.)
export const LURE_LEVEL_XP = [300, 400, 500, 600, 700];

// --- Pond / casting / luring ---
export const RESULT_DURATION = 500;
export const CAST_MIN = 5;
export const CAST_DURATION_MIN = 0.5;
export const CAST_DURATION_MAX = 2.0;
export const CAST_CHARGE_DURATION = 1500;
export const LURING_REEL_MAX_SPEED = 9;
export const LURING_REEL_ACCEL = 20;
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
