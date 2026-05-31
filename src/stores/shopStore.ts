import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { ShopUpgradeData, StatName, loadShopData } from "../util/csvLoader";
import { addLure, addToStat, deductMoney, getWallet } from "./playerStore";
import { pushEvent } from "./eventLogStore";
import { EventMsg } from "../util/eventMessages";

interface ShopUpgrade extends ShopUpgradeData {
  level: number;
}

interface ShopState {
  upgrades: ShopUpgrade[];
  loaded: boolean;
}

export const useShop = create(
  subscribeWithSelector<ShopState>(() => ({
    upgrades: [],
    loaded: false,
  })),
);

export async function initShop() {
  const data = await loadShopData();
  const upgrades = data.map((d) => ({ ...d, level: 0 }));
  useShop.setState({ upgrades, loaded: true });
}

export function getUpgradePrice(upgrade: ShopUpgrade): number | null {
  if (upgrade.level >= upgrade.prices.length) return null;
  return upgrade.prices[upgrade.level];
}

export function canAffordUpgrade(upgrade: ShopUpgrade): boolean {
  const price = getUpgradePrice(upgrade);
  if (price === null) return false;
  return getWallet() >= price;
}

export function isMaxed(upgrade: ShopUpgrade): boolean {
  return upgrade.level >= upgrade.prices.length;
}

export function buyUpgrade(id: string) {
  const state = useShop.getState();
  const idx = state.upgrades.findIndex((u) => u.id === id);
  if (idx === -1) return;

  const upgrade = state.upgrades[idx];
  const price = getUpgradePrice(upgrade);
  if (price === null) return;
  if (getWallet() < price) return;

  deductMoney(price);

  const newLevel = upgrade.level + 1;

  // Apply stat change
  switch (upgrade.stat) {
    case StatName.LURE:
      addLure(upgrade.id);
      break;
    case StatName.ATTACK:
      addToStat("attack", upgrade.valuePerLevel);
      break;
    case StatName.DEFENSE:
      addToStat("defense", upgrade.valuePerLevel);
      break;
    case StatName.HP:
      addToStat("lineHP", upgrade.valuePerLevel);
      break;
    case StatName.INVENTORY:
      addToStat("inventorySize", upgrade.valuePerLevel);
      break;
  }

  // Update upgrade level
  const newUpgrades = [...state.upgrades];
  newUpgrades[idx] = { ...upgrade, level: newLevel };
  useShop.setState({ upgrades: newUpgrades });

  pushEvent(EventMsg.BOUGHT(upgrade.name, newLevel));
}
