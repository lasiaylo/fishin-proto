import { create } from "zustand";
import { clamp } from "../util/util";
import { subscribeWithSelector } from "zustand/middleware";

export interface Resource {
  amount: number;
  capacity: number;
  baseCapacity: number;
}

export enum RT {
  Money = "Money",
  Production = "Production",
  Jimby = "Jimby",
  Food = "Food",
  ExcessFood = "ExcessFood",
  CitySpace = "CitySpace",
  Space = "Space",
}

type ResourceState = { [key in RT]: Resource };
const MONEY_CAPACITY = 40;
const SPACE_CAPACITY = 12;
const PRODUCTION_CAPACITY = 200;
export const useResource = create(
  subscribeWithSelector<ResourceState>(() => ({
    [RT.Money]: init(MONEY_CAPACITY, MONEY_CAPACITY / 3),
    [RT.Production]: init(PRODUCTION_CAPACITY, 0),
    [RT.Jimby]: init(2, 1),
    [RT.Food]: init(50, 1),
    [RT.ExcessFood]: init(5, 0),
    [RT.CitySpace]: init(10, 10),
    [RT.Space]: init(SPACE_CAPACITY, SPACE_CAPACITY),
  })),
);

export const useResourceAmount = (rt: RT) => {
  return useResource((s) => s[rt].amount);
};

export const getResourceAmount = (rt: RT) => {
  return useResource.getState()[rt].amount;
};

export const setResourceAmount = (rt: RT, val: number) => {
  useResource.setState((state) => {
    const { amount, capacity } = state[rt];
    const newAmount = clamp(val, 0, capacity);
    if (newAmount === amount) return state;
    return {
      ...state,
      [rt]: { ...state[rt], amount: newAmount },
    };
  });
};

export const addResourceAmount = (rt: RT, val: number) => {
  setResourceAmount(rt, useResource.getState()[rt as RT].amount + val);
};

export const setResourceCapacity = (rt: RT, val: number) => {
  useResource.setState((state) => {
    return {
      ...state,
      [rt]: { ...state[rt], capacity: val },
    };
  });
};

export const addCapacity = (rt: RT, val: number) => {
  setResourceCapacity(rt, useResource.getState()[rt].capacity + val);
};
export const addToBaseCapacity = (rt: RT, val: number) => {
  setResourceCapacity(rt, useResource.getState()[rt].baseCapacity + val);
};

export function addRate(
  source: string,
  type: RT,
  display: number,
  amount: number,
) {
  addResourceAmount(type, amount);
}

function init(capacity: number, amount: number = 0): Resource {
  return {
    amount: amount,
    baseCapacity: capacity,
    capacity: capacity,
  };
}
