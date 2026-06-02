import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { FishData, loadFishData } from "../util/csvLoader";
import { usePlayer } from "./playerStore";
import { randomRange } from "../util/random";

const HOOK_ROLL: [number, number] = [0.9, 1.1];

export function randomizeFishStats(fish: FishData): FishData {
  const multiplier = randomRange(...HOOK_ROLL);
  const randomizedPrice = Math.round(fish.basePrice * multiplier);
  return {
    ...fish,
    attack: parseFloat((fish.attack * multiplier).toFixed(2)),
    defense: parseFloat((fish.defense * multiplier).toFixed(2)),
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

export async function initFish() {
  const data = await loadFishData();
  useFish.setState({ allFish: data });
}

export function getAvailableFish(): FishData[] {
  const { allFish } = useFish.getState();
  const { selectedLure } = usePlayer.getState();
  const effectiveLure = selectedLure ?? "";
  return allFish.filter((f) => f.requiredLure === effectiveLure);
}
