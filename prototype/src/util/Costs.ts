import { addResourceAmount, RT, useResource } from "../stores/resourceStore";
import { useShallow } from "zustand/react/shallow";
import { pick } from "./util";

export type Costs = { [key in RT]?: Cost };

export interface Cost {
  initCosts: number[];
  growthRate?: number;
}

export type DetailedCosts = {
  [key in RT]?: {
    calculatedCost: number;
    atCost: number;
  };
};

export function getCalculatedCosts(costs: Costs, amount?: number) {
  return Object.fromEntries(
    Object.entries(costs).map(([resource, cost]) => {
      return [resource, getCalculatedCost(cost, amount)];
    }),
  );
}

export function getCalculatedCost(cost: Cost, amount?: number) {
  const { initCosts, growthRate } = cost;
  const amt = Math.floor(amount ?? 0);
  const initCost = getInitCost(initCosts, amt);
  const growthAmount = amt - initCosts.length + 1;
  if (growthRate === undefined || growthAmount <= 0) {
    return initCost;
  }
  const calc = initCost * growthRate ** growthAmount;
  return Math.ceil(calc);
}

export function useDetailedCosts(costs: Costs, amount?: number): DetailedCosts {
  const calculatedCosts = getCalculatedCosts(costs, amount);
  const atCost = useAtCost(costs, amount);
  return Object.fromEntries(
    Object.keys(costs).map((rt) => [
      rt,
      { calculatedCost: calculatedCosts[rt], atCost: atCost[rt] },
    ]),
  );
}

export function useAtCost(cost: Costs, amount?: number) {
  return useResource(
    useShallow((state) => {
      const amounts = pick(state, Object.keys(cost));
      return Object.fromEntries(
        Object.entries(cost).map(([rt, resourceCost]) => {
          if (rt === RT.Money) {
          }
          return [
            rt,
            amounts[RT[rt as keyof typeof RT]].amount >=
              getCalculatedCost(resourceCost, amount),
          ];
        }),
      );
    }),
  );
}

export function useEveryAtCost(cost: Costs, amount?: number) {
  return useResource((state) => {
    const amounts = pick(state, Object.keys(cost));
    return Object.entries(cost).every(
      ([rt, resourceCost]) =>
        amounts[RT[rt as keyof typeof RT]].amount >=
        getCalculatedCost(resourceCost, amount),
    );
  });
}

export function deductCost(cost: Costs, amount?: number) {
  Object.entries(cost).forEach(([rt, resourceCost]) => {
    addResourceAmount(
      RT[rt as keyof typeof RT],
      -getCalculatedCost(resourceCost, amount),
    );
  });
}

function getInitCost(initCosts: number[], amount?: number) {
  const idx = Math.max(0, Math.min(amount ?? 0, initCosts.length - 1));
  return initCosts[idx];
}
