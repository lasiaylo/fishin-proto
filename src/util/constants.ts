export const MS_IN_SEC = 1000;
export const MS_IN_MIN = MS_IN_SEC * 60;
export const FPS = 60;

export const XP_PER_DISTANCE = 1;
export const XP_WIN = 30;
export const XP_LOSS = 10;
// Cumulative XP required to reach each level boundary (index 0 = level 1, etc.)
export const LURE_LEVEL_XP = [100, 250, 450, 700, 1000, 1350, 1750, 2200, 2700, 3250];

export function computeLureLevel(xp: number): number {
  let level = 0;
  for (const threshold of LURE_LEVEL_XP) {
    if (xp >= threshold) level++;
    else break;
  }
  return level;
}
