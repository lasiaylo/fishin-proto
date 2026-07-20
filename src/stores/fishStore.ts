import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { FishData, loadFishData } from "../util/csvLoader";
import { randomRange } from "../util/random";
import {
  Rarity,
  rollRarity,
  RARITY_STAT_MULTIPLIER,
  RARITY_PRICE_MULTIPLIER,
  BASE_FISH_ID,
} from "../util/constants";

const AD_ROLL: [number, number] = [0.95, 1.05];
const THRASH_ROLL: [number, number] = [0.95, 1];

export function randomizeFishStats(
  fish: FishData,
  forcedRarity?: Rarity,
): FishData {
  const rarity =
    fish.id === BASE_FISH_ID ? Rarity.COMMON : (forcedRarity ?? rollRarity());
  const statMult = RARITY_STAT_MULTIPLIER[rarity];
  const aRoll = randomRange(...AD_ROLL);
  const dRoll = randomRange(...AD_ROLL);
  const thrashRoll = randomRange(...THRASH_ROLL);
  const avgRoll = (aRoll + dRoll + thrashRoll) / 3;
  const randomizedPrice = Math.round(
    fish.basePrice * avgRoll * RARITY_PRICE_MULTIPLIER[rarity],
  );
  return {
    ...fish,
    attack: parseFloat((fish.attack * aRoll * statMult).toFixed(2)),
    defense: parseFloat((fish.defense * dRoll * statMult).toFixed(2)),
    thrash: parseFloat((fish.thrash * thrashRoll * statMult).toFixed(2)),
    hp: parseFloat((fish.hp * aRoll * statMult).toFixed(1)),
    basePrice: fish.id === "FISH_B_0" ? fish.basePrice : randomizedPrice,
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
