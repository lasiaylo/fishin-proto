import { create } from "zustand";
import { usePlayer } from "./playerStore";
import { clearEvents } from "./eventLogStore";
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

// Slot indices of rods currently mid-fight. The day is never allowed to end
// while this is non-empty — set/cleared by PondView via setFighting().
const fightingSlots = new Set<number>();
// Sticky: sequences the timer or a forced end-of-day past an in-progress
// fight, so it takes effect the instant the last fight ends.
let endOfDayRequested = false;

function applyEndOfDayIfReady() {
  if (!endOfDayRequested || fightingSlots.size > 0) return;
  useDayStore.setState((s) => (s.isEndOfDay ? s : { isEndOfDay: true }));
}

export function setFighting(slotIndex: number, fighting: boolean) {
  if (fighting) fightingSlots.add(slotIndex);
  else fightingSlots.delete(slotIndex);
  applyEndOfDayIfReady();
}

export function tickDay(now: number) {
  const { dayStartTime, isEndOfDay } = useDayStore.getState();
  if (isEndOfDay) return;
  if (now - dayStartTime >= DAY_DURATION_MS) {
    endOfDayRequested = true;
  }
  applyEndOfDayIfReady();
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
  if (useDayStore.getState().isEndOfDay) return;
  endOfDayRequested = true;
  applyEndOfDayIfReady();
}

// Debug-only: pulls dayStartTime backward so the day appears to have
// elapsed by `ms` more, then re-runs the same end-of-day check tickDay
// does on its normal interval — a no-op once the day has already ended.
export function advanceTime(ms: number) {
  const { isEndOfDay } = useDayStore.getState();
  if (isEndOfDay) return;
  useDayStore.setState((s) => ({ dayStartTime: s.dayStartTime - ms }));
  tickDay(Date.now());
}

export function startNewDay() {
  useDayStore.setState((s) => ({
    dayNumber: s.dayNumber + 1,
    dayStartTime: Date.now(),
    moneyEarnedToday: 0,
    fishCaughtToday: 0,
    isEndOfDay: false,
  }));
  endOfDayRequested = false;
  clearEvents();
}

usePlayer.subscribe(
  (s) => s.wallet,
  (wallet, prevWallet) => {
    if (wallet > prevWallet) recordEarnings(wallet - prevWallet);
  },
);
