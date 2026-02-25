import { Resource, RT } from "./resourceStore";
import { create } from "zustand";
import { clamp } from "../util/util";
import { TransferVector } from "../Vectors/TransferVector";

export enum FuelT {
  FlowerFuel = "FlowerFuel",
}

interface Fuel extends Resource {
  growth: number;
  burn: number;
}

export interface FuelState {
  [FuelT.FlowerFuel]: Fuel;
}

export const useFuel = create<FuelState>((set) => ({
  [FuelT.FlowerFuel]: {
    amount: 0,
    baseCapacity: 500,
    capacity: 500,
    growth: 3,
    burn: 1,
  },
}));

const Fuels: Map<FuelT, TransferVector> = new Map();

export function isLit() {
  const fuels = useFuel.getState();
  return Object.values(fuels).some(({ amount }) => amount > 0);
}

export function setFuel(type: FuelT, val: number) {
  useFuel.setState((state) => {
    const { amount, baseCapacity } = state[type];
    const newAmount = clamp(val, 0, baseCapacity);
    if (newAmount === amount) return state;

    return {
      ...state,
      [type]: { ...state[type], amount: newAmount },
    };
  });
}

export function addFuel(type: FuelT, val: number) {
  setFuel(type, useFuel.getState()[type].amount + val);
  if (!Fuels.has(type)) {
    Fuels.set(type, makeTransfer(type));
  }
  Fuels.get(type)?.run();
}

function makeTransfer(type: FuelT) {
  const { growth, burn } = useFuel.getState()[type];
  // const { growth, burn } = BurnRates.get(rt) as BurnRate;
  return new TransferVector(type, RT.Bread, growth, { [type]: burn });
}
