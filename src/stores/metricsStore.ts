import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

interface MetricsState {
  totalCasts: number;
  totalFishCaught: number;
}

export const useMetrics = create(
  subscribeWithSelector<MetricsState>(() => ({
    totalCasts: 0,
    totalFishCaught: 0,
  })),
);

export function incrementTotalCasts() {
  useMetrics.setState((s) => ({ totalCasts: s.totalCasts + 1 }));
}

export function incrementTotalFishCaught() {
  useMetrics.setState((s) => ({ totalFishCaught: s.totalFishCaught + 1 }));
}
