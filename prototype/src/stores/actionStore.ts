import { create } from "zustand";
import { addResourceAmount, RT } from "./resourceStore";
import { Costs, deductCost } from "../util/Costs";
import { Unlockable } from "../components/unlocks";
import { UpgradeT, useUpgrade } from "./upgradeStore";

export enum ActionT {
  Stoke = "Stoke",
  Develop = "Develop",
}

export interface GameAction extends Unlockable {
  flavor: string;
  effect?: string;
  costs?: Costs;
}

export interface Action extends GameAction {
  onUse: () => void;
  cooldown?: number;
  properties?: any;
}

export type ActionState = { [key: string]: Action };
//@ts-ignore
export const useAction = create<ActionState>(() => ({
  [ActionT.Develop]: {
    flavor: "Build developments",
    costs: { [RT.Money]: { initCosts: [20], growthRate: 0 } },
    cooldown: 3.5,
    onUse: bake,
    unlocked: true,
    properties: {
      effect: 1,
      nthCap: 10,
      nthCount: 0,
      nthEffect: 19,
    },
  },
}));

export function setProperties(type: ActionT, properties: any) {
  useAction.setState((s: ActionState) => ({
    ...s,
    [type]: {
      ...s[type],
      properties: properties,
    },
  }));
}

export function triggerAction(type: string) {
  const action = useAction.getState()[type];
  action.onUse();
  if (action.costs != undefined) {
    deductCost(action.costs);
  }
}

function bake() {
  console.log("bakeC");
}
