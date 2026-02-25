import {
  addResourceAmount,
  RT,
  setResourceAmount,
  setResourceCapacity,
  useResource,
} from "./resourceStore";
import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { getTickRate } from "../util/util";
import { getEventFn, UpdateEvent } from "../GameLoop";
import { addProduceProgress, ProduceT } from "./produceStore";

export enum VectorT {
  Money = "Money",
  Production = "Production",
  Growth = "Growth",
  Things = "Things",
}

export interface Vector {
  amount: number;
  target?: RT | ProduceT;
  baseRate?: number;
}

type VectorState = { [key in VectorT]: Vector };

export const BASE_FOOD_COST = 5;
const FOOD_LINEAR_GROWTH = 5;
const FOOD_GROWTH = 1.5;
export const useVector = create(
  subscribeWithSelector<VectorState>(() => {
    return {
      [VectorT.Money]: getVector(RT.Money, 1, 1),
      [VectorT.Production]: getVector(RT.Production, 1, 0),
      [VectorT.Growth]: getVector(RT.Jimby, 0.001, 0),
    };
  }),
);

export function initVectors() {
  const tick = getEventFn((e) => tickVectors(e.deltaTime));
  // @ts-ignore
  const fn = (e) => {
    // variance(e)
    tick(e);
  };

  useResource.subscribe(
    (s) => s[RT.CitySpace].amount,
    (val) => setResourceCapacity(RT.Jimby, val * 2),
  );
  useResource.subscribe(
    (s) => Math.floor(s[RT.Jimby].amount),
    setVectorAmountFn(VectorT.Money),
  );

  useResource.subscribe((s) => Math.floor(s[RT.Jimby].amount), getFood);
  useResource.subscribe((s) => Math.floor(s[RT.Food].amount), getFood);

  addEventListener(UpdateEvent, fn);
  // INIT is called twice in dev mode. Need to run cleanup function
  return () => {
    removeEventListener(UpdateEvent, fn);
  };
}

function tickVectors(deltaTime: number) {
  if (deltaTime === 0) return;
  const vectors = useVector.getState();
  Object.values(vectors).forEach(({ amount, target, baseRate }) => {
    if (target === undefined || baseRate === undefined) return;
    const totalRate = amount * baseRate;
    const delta = getTickRate(totalRate, deltaTime);

    const fn = Object.keys(RT).includes(target)
      ? addResourceAmount
      : addProduceProgress;
    // @ts-ignore
    fn(target, delta);
  });
}

function getFood() {
  const resources = useResource.getState();
  const foodAmount = Math.floor(resources[RT.Food].amount);
  const jimbyAmount = Math.floor(resources[RT.Jimby].amount);

  const getCost = (x: number) =>
    x < 1 ? 1 : Math.ceil(BASE_FOOD_COST + x ** FOOD_GROWTH);
  const prevCost = getCost(jimbyAmount - 1) ?? 0;
  const nextCost = getCost(jimbyAmount);

  let excessFood = foodAmount - prevCost;
  const growthAmount = Math.max(0, Math.floor((excessFood / nextCost) * 100));

  setResourceCapacity(RT.ExcessFood, nextCost + 2);
  setResourceAmount(RT.ExcessFood, excessFood);
  setVectorAmount(VectorT.Growth, growthAmount);
}

export function useTotalRate(rt: RT) {
  return useVector(getTotalRateSelector(rt));
}

function getTotalRateSelector(rt: RT) {
  return (s: VectorState) =>
    Object.values(s)
      .filter(({ target }) => target === rt)
      .reduce((prev, curr) => prev + getRate(curr), 0);
}

function getRate({ baseRate, amount }: Vector) {
  return (baseRate ?? 0) * amount;
}

function getVector(target?: RT, baseRate?: number, amount: number = 0) {
  return {
    target: target,
    baseRate: baseRate,
    amount: amount,
  };
}

export function setVectorAmountFn(vt: VectorT) {
  return (val: number) => {
    setVectorAmount(vt, val);
  };
}

export function setVectorAmount(vt: VectorT, val: number) {
  return useVector.setState((s) => ({
    ...s,
    [vt]: {
      ...s[vt],
      amount: val,
    },
  }));
}

export function addVectorAmount(vt: VectorT, val: number) {
  const amount = useVector.getState()[vt].amount;
  setVectorAmount(vt, amount + val);
}
