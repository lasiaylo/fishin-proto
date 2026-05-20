import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

interface PlayerState {
  wallet: number;
  reelStrength: number;
  drag: number;
  lineStrength: number;
  ownedLures: Set<string>;
}

export const usePlayer = create(
  subscribeWithSelector<PlayerState>(() => ({
    wallet: 0,
    reelStrength: 10,
    drag: 1,
    lineStrength: 20,
    ownedLures: new Set<string>(),
  })),
);

export const getWallet = () => usePlayer.getState().wallet;

export function addMoney(amount: number) {
  usePlayer.setState((s) => ({ wallet: s.wallet + amount }));
}

export function deductMoney(amount: number) {
  usePlayer.setState((s) => ({ wallet: Math.max(0, s.wallet - amount) }));
}

export function setStat(stat: string, value: number) {
  usePlayer.setState((s) => ({ ...s, [stat]: value }));
}

export function addToStat(stat: string, value: number) {
  usePlayer.setState((s) => {
    const current = (s as unknown as Record<string, unknown>)[stat];
    if (typeof current !== "number") return s;
    return { ...s, [stat]: current + value };
  });
}

export function addLure(lureId: string) {
  usePlayer.setState((s) => {
    const lures = new Set(s.ownedLures);
    lures.add(lureId);
    return { ownedLures: lures };
  });
}
