import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

interface MetricsState {
  totalCasts: number;
  castsByItem: Record<string, number>;
  totalFishCaught: number;
  totalSits: number;
}

export const useMetrics = create(
  subscribeWithSelector<MetricsState>(() => ({
    totalCasts: 0,
    castsByItem: {},
    totalFishCaught: 0,
    totalSits: 0,
  })),
);

export function incrementTotalCasts(itemId: string) {
  useMetrics.setState((s) => ({
    totalCasts: s.totalCasts + 1,
    castsByItem: {
      ...s.castsByItem,
      [itemId]: (s.castsByItem[itemId] ?? 0) + 1,
    },
  }));
}

export function incrementTotalFishCaught() {
  useMetrics.setState((s) => ({ totalFishCaught: s.totalFishCaught + 1 }));
}

export function incrementTotalSits() {
  useMetrics.setState((s) => ({ totalSits: s.totalSits + 1 }));
}
