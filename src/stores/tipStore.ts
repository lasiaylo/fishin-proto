import { create } from "zustand";
import { TipData, loadTipData } from "../util/csvLoader";

interface TipState {
  tipData: TipData[];
}

export const useTipData = create<TipState>(() => ({ tipData: [] }));

export async function initTipData() {
  const data = await loadTipData();
  useTipData.setState({ tipData: data });
}

export function getTipById(id: string): TipData | undefined {
  return useTipData.getState().tipData.find((t) => t.id === id);
}
