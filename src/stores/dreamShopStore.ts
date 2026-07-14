import { loadShopData, ShopCsvLocation } from "../util/csvLoader";
import { createUpgradeStore } from "./upgradeStoreFactory";
import { deductDreamPoints, useDreamStore } from "./dreamStore";

const DREAM_SHOP_LOCATION: ShopCsvLocation = {
  folder: "Dream",
  displayFile: "Dream/DreamShopDisplay.csv",
};

const {
  useUpgradeStore: useDreamShop,
  initShopFromData: initDreamShopFromData,
  getUpgradePrice: getDreamUpgradePrice,
  canAffordUpgrade: canAffordDreamUpgrade,
  isMaxed: isDreamUpgradeMaxed,
  buyUpgrade: buyDreamUpgrade,
  setUpgradeLevelDebug: setDreamUpgradeLevelDebug,
  resetAllUpgradesDebug: resetAllDreamUpgradesDebug,
} = createUpgradeStore({
  storageKey: "debug_dream_upgrade_levels",
  getCurrency: () => useDreamStore.getState().dreamPoints,
  deductCurrency: deductDreamPoints,
});

export {
  useDreamShop,
  initDreamShopFromData,
  getDreamUpgradePrice,
  canAffordDreamUpgrade,
  isDreamUpgradeMaxed,
  buyDreamUpgrade,
  setDreamUpgradeLevelDebug,
  resetAllDreamUpgradesDebug,
};

export async function initDreamShop(shopFile = "DreamShopGameplay.csv") {
  const data = await loadShopData(shopFile, DREAM_SHOP_LOCATION);
  initDreamShopFromData(data);
}
