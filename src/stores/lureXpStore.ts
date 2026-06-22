import { create } from "zustand";
import { computeLureLevel, LURE_LEVEL_XP } from "../util/constants";

interface LureXpEntry {
  xp: number;
  level: number;
}

interface LureXpState {
  lures: Record<string, LureXpEntry>;
}

export const useLureXp = create<LureXpState>(() => ({
  lures: {},
}));

export function addLureXp(lureId: string, amount: number): boolean {
  const prev = useLureXp.getState().lures[lureId] ?? { xp: 0, level: 0 };
  const newXp = prev.xp + amount;
  const newLevel = computeLureLevel(newXp);
  const leveledUp = newLevel > prev.level;
  useLureXp.setState((s) => ({
    lures: { ...s.lures, [lureId]: { xp: newXp, level: newLevel } },
  }));
  return leveledUp;
}

export function lureXpProgress(xp: number, level: number): number {
  const xpFloor = LURE_LEVEL_XP[level - 1] ?? 0;
  const xpCeil = LURE_LEVEL_XP[level] ?? null;
  return xpCeil !== null ? (xp - xpFloor) / (xpCeil - xpFloor) : 1;
}
