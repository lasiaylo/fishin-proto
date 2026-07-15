import { create } from "zustand";
import { RodData, loadRodData, levelStat } from "../util/csvLoader";
import { Rod, CAST_MAX, LURING_REEL_MAX_SPEED } from "../util/constants";

interface RodDataState {
  rodData: RodData[];
}

export const useRodData = create<RodDataState>(() => ({ rodData: [] }));

export async function initRodData() {
  const data = await loadRodData();
  useRodData.setState({ rodData: data });
}

export function getRodDataById(id: string): RodData | undefined {
  return useRodData.getState().rodData.find((r) => r.id === id);
}

export function getRodStats(rod: Rod): {
  attack: number;
  defense: number;
  castMax: number;
  speedMultiplier: number;
  reelMaxSpeed: number;
} {
  const data = getRodDataById(rod.id);
  return {
    attack: levelStat(data?.attackLevels ?? [], rod.attackLevel),
    defense: levelStat(data?.defenseLevels ?? [], rod.defenseLevel),
    castMax: data?.castMax ?? CAST_MAX,
    speedMultiplier: data?.speedMultiplier ?? 1,
    reelMaxSpeed: data?.reelMaxSpeed ?? LURING_REEL_MAX_SPEED,
  };
}
