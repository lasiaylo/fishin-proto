import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { Cost, Costs, deductCost } from "../util/Costs";
import { addToBaseCapacity, RT } from "./resourceStore";
import { ActionT, GameAction } from "./actionStore";
import { useShallow } from "zustand/react/shallow";
import _ from "lodash";

export const GROWTH_RATE = 1.25;
export const JIMBY_GROWTH_RATE = 1.35;

export enum UpgradeT {
  Town = "Town",
}

export interface Buyable extends GameAction {
  amount: number;
  capacity: number;
  costs: Costs;
}

type UpgradeState = { [key in UpgradeT]: Buyable };
export const useUpgrade = create(
  subscribeWithSelector<UpgradeState>(() => ({
    [UpgradeT.Town]: getUpgrade(
      "Increases deliverer capacity",
      getRTCost(RT.Money, 30),
      100,
      "Capacity: +1",
    ),
  })),
);

function getUpgrade(
  flavor: string,
  costs: Costs,
  capacity: number = 100,
  effect?: string,
) {
  return {
    flavor: flavor,
    amount: 0,
    capacity: capacity,
    costs: costs,
    effect: effect,
  };
}

export function initUpgrades() {}

function subscribeUpgrade(
  type: UpgradeT,
  fn: (val: number) => void,
  fireImmediately: boolean = false,
) {
  useUpgrade.subscribe((s) => s[type].amount, fn, { fireImmediately });
}

function getRTCost(rt: RT, ...initCosts: number[]) {
  return {
    [rt]: getCost(initCosts),
  };
}

function getCost(
  initCost: number | number[],
  growthRate: number = GROWTH_RATE,
  growthCost?: number,
): Cost {
  return {
    initCosts: typeof initCost === "number" ? [initCost] : initCost,
    growthRate: growthRate,
  };
}

export function buyItem(type: UpgradeT) {
  const { costs, amount, capacity } = useUpgrade.getState()[type];
  deductCost(costs, amount);

  const unlocked = amount + 1 < capacity;

  useUpgrade.setState((state) => {
    const { amount } = state[type];
    return {
      ...state,
      [type]: { ...state[type], amount: amount + 1, unlocked },
    };
  });
}

// @ts-ignore
function syncCapacity(upgradeT: UpgradeT, rt: RT, growthAmount: number) {
  useUpgrade.subscribe(
    (s) => s[upgradeT].amount,
    (val, _) => addToBaseCapacity(rt, growthAmount * val),
  );
}

export function useUnlockedUpgrades() {
  return useUpgrade(
    useShallow((s) => _.pickBy(s, (upgrade: Buyable) => upgrade.unlocked)),
  );
}
