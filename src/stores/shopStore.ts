import {
  loadShopData,
  loadShopDisplayMap,
  parseShopGameplayRows,
} from "../util/csvLoader";
import { deductMoney, getWallet } from "./playerStore";
import { createUpgradeStore } from "./upgradeStoreFactory";
import { useMetrics } from "./metricsStore";
import { SHOP_UNLOCK_FISH_CAUGHT } from "../util/constants";

const {
  useUpgradeStore: useShop,
  initShopFromData,
  getUpgradePrice,
  canAffordUpgrade,
  isMaxed,
  buyUpgrade,
  setUpgradeLevelDebug,
  resetAllUpgradesDebug,
} = createUpgradeStore({
  storageKey: "debug_upgrade_levels",
  getCurrency: getWallet,
  deductCurrency: deductMoney,
});

export {
  useShop,
  initShopFromData,
  getUpgradePrice,
  canAffordUpgrade,
  isMaxed,
  buyUpgrade,
  setUpgradeLevelDebug,
  resetAllUpgradesDebug,
};

export async function initShop(shopFile?: string) {
  const data = await loadShopData(shopFile);
  initShopFromData(data);
}

export async function initShopFromRows(rows: string[][]) {
  const displayMap = await loadShopDisplayMap();
  initShopFromData(parseShopGameplayRows(rows, displayMap));
}

// Shared by App.jsx (renders the ever-present ShopView) and any minigame tab
// that needs to know whether the shop panel is showing, so the threshold
// lives in one place.
export function useShopUnlocked(): boolean {
  const totalFishCaught = useMetrics((s) => s.totalFishCaught);
  const hasShopUpgrades = useShop((s) => s.upgrades.some((u) => u.level > 0));
  return totalFishCaught >= SHOP_UNLOCK_FISH_CAUGHT || hasShopUpgrades;
}
