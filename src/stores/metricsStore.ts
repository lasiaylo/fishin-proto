import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

interface MetricsState {
  totalCasts: number;
}

export const useMetrics = create(
  subscribeWithSelector<MetricsState>(() => ({
    totalCasts: 0,
  })),
);

export function incrementTotalCasts() {
  useMetrics.setState((s) => ({ totalCasts: s.totalCasts + 1 }));
}
