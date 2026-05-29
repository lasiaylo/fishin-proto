import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

interface PlayerState {
  wallet: number;
  reelStrength: number;
  drag: number;
  lineHP: number;
  ownedLures: Set<string>;
}

export const INITIAL_PLAYER_STATE = {
  wallet: 0,
  reelStrength: 3,
  drag: 3,
  lineHP: 10,
};

export const usePlayer = create(
  subscribeWithSelector<PlayerState>(() => ({
    ...INITIAL_PLAYER_STATE,
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
