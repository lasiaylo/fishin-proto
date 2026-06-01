import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { FishData, loadFishData } from "../util/csvLoader";
import { usePlayer } from "./playerStore";

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
