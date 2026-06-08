import { create } from "zustand";
import { FISH_CSVS, SHOP_CSVS } from "virtual:csv-manifest";

export { FISH_CSVS, SHOP_CSVS };

interface CsvConfigState {
  fishCSV: string;
  shopCSV: string;
}

export const useCsvConfig = create<CsvConfigState>(() => ({
  fishCSV: FISH_CSVS[0] ?? "FishGameplay.csv",
  shopCSV: SHOP_CSVS[0] ?? "ShopGameplay.csv",
}));

export function setCsvConfig(patch: Partial<CsvConfigState>) {
  useCsvConfig.setState(patch);
}
