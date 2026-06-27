import { create } from "zustand";
import { applyLureXp, LURE_LEVEL_XP } from "../util/constants";

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
  const { xp, level, leveledUp } = applyLureXp(prev.xp, amount);
  useLureXp.setState((s) => ({
    lures: { ...s.lures, [lureId]: { xp, level } },
  }));
  return leveledUp;
}

export function lureXpProgress(xp: number, level: number): number {
  const xpFloor = LURE_LEVEL_XP.slice(0, level).reduce((a, b) => a + b, 0);
  const nextReq = LURE_LEVEL_XP[level] ?? null;
  return nextReq !== null ? (xp - xpFloor) / nextReq : 1;
}
