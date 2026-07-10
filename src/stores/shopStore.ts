import {
  loadShopData,
  loadShopDisplayMap,
  parseShopGameplayRows,
} from "../util/csvLoader";
import { deductMoney, getWallet } from "./playerStore";
import { createUpgradeStore } from "./upgradeStoreFactory";

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
