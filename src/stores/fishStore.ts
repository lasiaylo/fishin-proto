import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { FishData, loadFishData } from "../util/csvLoader";
import { usePlayer } from "./playerStore";

interface FishState {
  allFish: FishData[];
  loaded: boolean;
}

export const useFish = create(
  subscribeWithSelector<FishState>(() => ({
    allFish: [],
    loaded: false,
  })),
);

export async function initFish() {
  const data = await loadFishData();
  useFish.setState({ allFish: data, loaded: true });
}

export function getAvailableFish(): FishData[] {
  const { allFish } = useFish.getState();
  const { ownedLures } = usePlayer.getState();
  return allFish.filter(
    (f) => !f.requiredLure || ownedLures.has(f.requiredLure),
  );
}
