import { create } from "zustand";
import { RT, useResource } from "./resourceStore";
import { JIMBY_GROWTH_RATE } from "./upgradeStore";
import { getCalculatedCost } from "../util/Costs";
import { Unlockable } from "../components/unlocks";
import { setVectorAmountFn, useVector, VectorT } from "./vectorStore";
import { subscribeWithSelector } from "zustand/middleware";

export enum ProduceT {
  Kindle = "Kindle",
  TheBakery = "Bakery",
  Housing = "Housing",
}

export interface Produce extends Unlockable {
  flavor: string;
  effect: string;
  progress: number;
  requirement: number;
  amount: number;
  capacity: number;
}

type ProduceState = { [key in ProduceT]: Produce };
export const useProduce = create(
  subscribeWithSelector<ProduceState>(() => ({
    [ProduceT.Kindle]: getProduce("Start the Fire", "Fire: +0.2/s", 3, 4, true),
    [ProduceT.TheBakery]: getProduce("Form the Bakery", "???", 20, 1, true),
    [ProduceT.Housing]: getProduce(
      "Make a house for jimbys to live in",
      "🐱: +2",
      20,
      10,
    ),
  })),
);

interface FocusedProduceState {
  focus: ProduceT | undefined;
}

export const useFocusedProduce = create<FocusedProduceState>((s) => ({
  focus: undefined,
}));

function getProduce(
  flavor: string,
  effect: string,
  requirement: number,
  capacity: number = 1,
  unlocked: boolean = false,
): Produce {
  return {
    flavor: flavor,
    effect: effect,
    requirement: requirement,
    capacity: capacity,
    unlocked: unlocked,
    amount: 0,
    progress: 0,
  };
}

export function initProduce() {
  const unsubs = [
    subscribeProduce(ProduceT.Kindle, setVectorAmountFn(VectorT.Kindle)),
    subscribeProduce(ProduceT.Housing, (val) => {
      useResource.setState((s) => {
        s[RT.Jimby].amount += 2;
        s[RT.Jimby].capacity += 2;
        return s;
      });
      useProduce.setState((s) => {
        s[ProduceT.Housing].requirement = getCalculatedCost(
          {
            initCosts: [20],
            growthRate: JIMBY_GROWTH_RATE,
          },
          val,
        );
        return s;
      });
    }),
  ];
  return () => unsubs.forEach((unsub) => unsub());
}

export function setFocus(produceType: ProduceT | undefined) {
  useFocusedProduce.setState(() => ({
    focus: produceType,
  }));
  createProduce(produceType);
}

function createProduce(pt: ProduceT | undefined) {
  useVector.setState((s) => ({
    ...s,
    [VectorT.Produce]: {
      ...s[VectorT.Produce],
      target: pt,
    },
  }));
}

function subscribeProduce(type: ProduceT, fn: (val: number) => void) {
  return useProduce.subscribe(
    (s) => s[type].amount,
    (val, prev) => {
      if (val <= prev) return;
      fn(val);
    },
  );
}

export function addProduceProgress(type: ProduceT, val: number) {
  useProduce.setState((s) => {
    const { requirement, progress, amount, capacity, unlocked } = s[type];
    let newProgress = progress + val;
    let newAmount = amount;
    let newUnlocked = unlocked;

    if (newProgress >= requirement) {
      newProgress = 0;
      newAmount = amount + 1;
      setFocus(undefined);
    }
    if (newAmount >= capacity) {
      newUnlocked = false;
      setFocus(undefined);
    }

    return {
      ...s,
      [type]: {
        ...s[type],
        progress: newProgress,
        amount: newAmount,
        unlocked: newUnlocked,
      },
    };
  });
}
