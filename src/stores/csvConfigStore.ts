import { create } from "zustand";
import { persist } from "zustand/middleware";
import { FISH_CSVS, SHOP_CSVS } from "virtual:csv-manifest";

export { FISH_CSVS, SHOP_CSVS };

interface CsvConfigState {
  fishCSV: string;
  shopCSV: string;
}

export const useCsvConfig = create<CsvConfigState>()(
  persist(
    () => ({
      fishCSV: FISH_CSVS[0] ?? "FishGameplay.csv",
      shopCSV: SHOP_CSVS[0] ?? "ShopGameplay.csv",
    }),
    { name: "csv-config" },
  ),
);

export function setCsvConfig(patch: Partial<CsvConfigState>) {
  useCsvConfig.setState(patch);
}
