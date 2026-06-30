import { create } from "zustand";
import { BaitData, loadBaitData } from "../util/csvLoader";

interface BaitState {
  baitData: BaitData[];
}

export const useBaitData = create<BaitState>(() => ({ baitData: [] }));

export async function initBaitData() {
  const data = await loadBaitData();
  useBaitData.setState({ baitData: data });
}

export function getBaitById(id: string): BaitData | undefined {
  return useBaitData.getState().baitData.find((b) => b.id === id);
}
