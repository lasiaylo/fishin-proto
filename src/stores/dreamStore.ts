import { create } from "zustand";
import { usePlayer } from "./playerStore";
import { computeDreamPoints } from "../util/constants";

interface DreamState {
  cumulativeMoneyEarned: number;
  dreamPoints: number;
}

export const useDreamStore = create<DreamState>(() => ({
  cumulativeMoneyEarned: 0,
  dreamPoints: 0,
}));

export function recordEarnings(amount: number) {
  useDreamStore.setState((s) => {
    const cumulativeMoneyEarned = s.cumulativeMoneyEarned + amount;
    const dreamPoints =
      s.dreamPoints +
      computeDreamPoints(cumulativeMoneyEarned) -
      computeDreamPoints(s.cumulativeMoneyEarned);
    return { cumulativeMoneyEarned, dreamPoints };
  });
}

export function deductDreamPoints(amount: number) {
  useDreamStore.setState((s) => ({
    dreamPoints: Math.max(0, s.dreamPoints - amount),
  }));
}

usePlayer.subscribe(
  (s) => s.wallet,
  (wallet, prevWallet) => {
    if (wallet > prevWallet) recordEarnings(wallet - prevWallet);
  },
);
