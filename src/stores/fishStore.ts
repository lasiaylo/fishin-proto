import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { FishData, loadFishData } from "../util/csvLoader";
import { randomRange } from "../util/random";
import {
  Rarity,
  rollRarity,
  RARITY_STAT_MULTIPLIER,
  RARITY_PRICE_MULTIPLIER,
} from "../util/constants";

const HOOK_ROLL: [number, number] = [0.95, 1.05];

export function randomizeFishStats(fish: FishData): FishData {
  const rarity = fish.id === "FISH_0" ? Rarity.COMMON : rollRarity();
  const statMult = RARITY_STAT_MULTIPLIER[rarity];
  const hookRoll = randomRange(...HOOK_ROLL);
  const thrashRoll = randomRange(...HOOK_ROLL);
  const randomizedPrice = Math.round(
    fish.basePrice * hookRoll * RARITY_PRICE_MULTIPLIER[rarity],
  );
  return {
    ...fish,
    attack: parseFloat((fish.attack * hookRoll * statMult).toFixed(2)),
    defense: parseFloat((fish.defense * hookRoll * statMult).toFixed(2)),
    thrash: parseFloat((fish.thrash * thrashRoll * statMult).toFixed(2)),
    hp: parseFloat((fish.hp * hookRoll * statMult).toFixed(1)),
    basePrice: fish.id === "FISH_0" ? fish.basePrice : randomizedPrice,
    rarity,
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
