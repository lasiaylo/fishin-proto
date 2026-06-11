import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { FishData, loadFishData } from "../util/csvLoader";
import { usePlayer } from "./playerStore";
import { randomRange } from "../util/random";

const HOOK_ROLL: [number, number] = [0.9, 1.1];

export function randomizeFishStats(fish: FishData): FishData {
  const multiplier = randomRange(...HOOK_ROLL);
  const thrashMult = randomRange(...HOOK_ROLL);
  const randomizedPrice = Math.round(fish.basePrice * multiplier);
  return {
    ...fish,
    attack: parseFloat((fish.attack * multiplier).toFixed(2)),
    defense: parseFloat((fish.defense * multiplier).toFixed(2)),
    thrash: parseFloat((fish.thrash * thrashMult).toFixed(2)),
    hp: parseFloat((fish.hp * multiplier).toFixed(1)),
    basePrice:
      fish.id === "FISH_1"
        ? Math.max(fish.basePrice, randomizedPrice)
        : randomizedPrice,
  };
}

interface FishState {
  allFish: FishData[];
}

export const useFish = create(
  subscribeWithSelector<FishState>(() => ({
    allFish: [],
  })),
);

export async function initFish(fishFile?: string) {
  const data = await loadFishData(fishFile);
  useFish.setState({ allFish: data });
}

export function initFishFromData(data: FishData[]) {
  useFish.setState({ allFish: data });
}
