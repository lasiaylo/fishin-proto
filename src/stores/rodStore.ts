import { create } from "zustand";
import { levelStat, loadRodData, RodData } from "../util/csvLoader";
import { Rod } from "../util/constants";

interface RodDataState {
  rodData: RodData[];
}

export const useRodData = create<RodDataState>(() => ({ rodData: [] }));

export async function initRodData() {
  const data = await loadRodData();
  useRodData.setState({ rodData: data });
}

export function getRodDataById(id: string): RodData {
  return useRodData.getState().rodData.find((r) => r.id === id) as RodData;
}

export function getRodStats(rod: Rod): {
  attack: number;
  defense: number;
  lineHP: number;
  castMax: number;
  speedMultiplier: number;
  reelMaxSpeed: number;
} {
  const data = getRodDataById(rod.id);
  return {
    attack: levelStat(data.attackBase, data.attackPerLevel, rod.attackLevel),
    defense: levelStat(
      data.defenseBase,
      data.defensePerLevel,
      rod.defenseLevel,
    ),
    lineHP: levelStat(data.lineHpBase, data.lineHpPerLevel, rod.lineHpLevel),
    castMax: data.castMax,
    speedMultiplier: data.speedMultiplier,
    reelMaxSpeed: data.reelMaxSpeed,
  };
}
