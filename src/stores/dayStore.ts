import { create } from "zustand";
import { usePlayer } from "./playerStore";
import {
  computeDreamPoints,
  DAY_DURATION_MS,
  DAY_PHASE_BOUNDARIES_MS,
  DayPhase,
} from "../util/constants";

interface DayState {
  dayNumber: number;
  dayStartTime: number;
  moneyEarnedToday: number;
  cumulativeMoneyEarned: number;
  fishCaughtToday: number;
  dreamPoints: number;
  isEndOfDay: boolean;
}

// Derived from dayStartTime, not stored — only InventoryView needs it, and
// it's cheap to recompute from elapsed time on every render.
export function phaseForElapsed(elapsed: number): DayPhase {
  if (elapsed < DAY_PHASE_BOUNDARIES_MS[0]) return DayPhase.NIGHT;
  if (elapsed < DAY_PHASE_BOUNDARIES_MS[1]) return DayPhase.DAWN;
  return DayPhase.SUNRISE;
}

export const useDayStore = create<DayState>(() => ({
  dayNumber: 1,
  dayStartTime: Date.now(),
  moneyEarnedToday: 0,
  cumulativeMoneyEarned: 0,
  fishCaughtToday: 0,
  dreamPoints: 0,
  isEndOfDay: false,
}));

export function tickDay(now: number) {
  const { dayStartTime, isEndOfDay } = useDayStore.getState();
  if (isEndOfDay) return;
  if (now - dayStartTime >= DAY_DURATION_MS) {
    useDayStore.setState({ isEndOfDay: true });
  }
}

export function recordEarnings(amount: number) {
  useDayStore.setState((s) => {
    const cumulativeMoneyEarned = s.cumulativeMoneyEarned + amount;
    const dreamPoints =
      s.dreamPoints +
      computeDreamPoints(cumulativeMoneyEarned) -
      computeDreamPoints(s.cumulativeMoneyEarned);
    return {
      moneyEarnedToday: s.moneyEarnedToday + amount,
      cumulativeMoneyEarned,
      dreamPoints,
    };
  });
}

export function recordCatch() {
  useDayStore.setState((s) => ({ fishCaughtToday: s.fishCaughtToday + 1 }));
}

export function deductDreamPoints(amount: number) {
  useDayStore.setState((s) => ({
    dreamPoints: Math.max(0, s.dreamPoints - amount),
  }));
}

export function forceEndDay() {
  useDayStore.setState((s) => (s.isEndOfDay ? s : { isEndOfDay: true }));
}

export function startNewDay() {
  useDayStore.setState((s) => ({
    dayNumber: s.dayNumber + 1,
    dayStartTime: Date.now(),
    moneyEarnedToday: 0,
    fishCaughtToday: 0,
    isEndOfDay: false,
  }));
}

usePlayer.subscribe(
  (s) => s.wallet,
  (wallet, prevWallet) => {
    if (wallet > prevWallet) recordEarnings(wallet - prevWallet);
  },
);
