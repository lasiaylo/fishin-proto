import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { ShopUpgradeData, StatName, loadShopData } from "../util/csvLoader";
import {
  addLure,
  addToStat,
  deductMoney,
  getWallet,
  removeLure,
} from "./playerStore";
import { pushEvent } from "./eventLogStore";
import { EventMsg } from "../util/eventMessages";
import { useSessionLog } from "./sessionLogStore";

interface ShopUpgrade extends ShopUpgradeData {
  level: number;
}

interface ShopState {
  upgrades: ShopUpgrade[];
}

export const useShop = create(
  subscribeWithSelector<ShopState>(() => ({
    upgrades: [],
  })),
);

const DEBUG_LEVELS_KEY = "debug_upgrade_levels";

function loadPersistedLevels(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(DEBUG_LEVELS_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function persistLevels(upgrades: ShopUpgrade[]) {
  const map: Record<string, number> = {};
  for (const u of upgrades) {
    if (u.level > 0) map[u.id] = u.level;
  }
  localStorage.setItem(DEBUG_LEVELS_KEY, JSON.stringify(map));
}

export async function initShop(shopFile?: string) {
  const data = await loadShopData(shopFile);
  const upgrades = data.map((d) => ({ ...d, level: 0 }));
  useShop.setState({ upgrades });

  const saved = loadPersistedLevels();
  for (const [id, level] of Object.entries(saved)) {
    setUpgradeLevelDebug(id, level);
  }
}

export function initShopFromData(data: ShopUpgradeData[]) {
  const upgrades = data.map((d) => ({ ...d, level: 0 }));
  useShop.setState({ upgrades });

  const saved = loadPersistedLevels();
  for (const [id, level] of Object.entries(saved)) {
    setUpgradeLevelDebug(id, level);
  }
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
    case StatName.CAST_DISTANCE:
      addToStat("castMax", upgrade.valuePerLevel);
      break;
  }

  // Update upgrade level
  const newUpgrades = [...state.upgrades];
  newUpgrades[idx] = { ...upgrade, level: newLevel };
  useShop.setState({ upgrades: newUpgrades });

  pushEvent(EventMsg.BOUGHT(upgrade.name, newLevel));
  useSessionLog
    .getState()
    .logUpgradeBought(upgrade.id, newLevel, upgrade.stat === StatName.LURE);
}

export function setUpgradeLevelDebug(id: string, newLevel: number) {
  const state = useShop.getState();
  const idx = state.upgrades.findIndex((u) => u.id === id);
  if (idx === -1) return;

  const upgrade = state.upgrades[idx];
  const clamped = Math.max(0, Math.min(newLevel, upgrade.prices.length));
  const delta = clamped - upgrade.level;
  if (delta === 0) return;

  switch (upgrade.stat) {
    case StatName.LURE:
      if (clamped > 0) addLure(upgrade.id);
      else removeLure(upgrade.id);
      break;
    case StatName.ATTACK:
      addToStat("attack", delta * upgrade.valuePerLevel);
      break;
    case StatName.DEFENSE:
      addToStat("defense", delta * upgrade.valuePerLevel);
      break;
    case StatName.HP:
      addToStat("lineHP", delta * upgrade.valuePerLevel);
      break;
    case StatName.INVENTORY:
      addToStat("inventorySize", delta * upgrade.valuePerLevel);
      break;
    case StatName.CAST_DISTANCE:
      addToStat("castMax", delta * upgrade.valuePerLevel);
      break;
  }

  const newUpgrades = [...state.upgrades];
  newUpgrades[idx] = { ...upgrade, level: clamped };
  useShop.setState({ upgrades: newUpgrades });
  persistLevels(newUpgrades);
}

export function resetAllUpgradesDebug() {
  const { upgrades } = useShop.getState();
  for (const u of upgrades) {
    if (u.level === 0) continue;
    const delta = -u.level;
    switch (u.stat) {
      case StatName.LURE:
        removeLure(u.id);
        break;
      case StatName.ATTACK:
        addToStat("attack", delta * u.valuePerLevel);
        break;
      case StatName.DEFENSE:
        addToStat("defense", delta * u.valuePerLevel);
        break;
      case StatName.HP:
        addToStat("lineHP", delta * u.valuePerLevel);
        break;
      case StatName.INVENTORY:
        addToStat("inventorySize", delta * u.valuePerLevel);
        break;
      case StatName.CAST_DISTANCE:
        addToStat("castMax", delta * u.valuePerLevel);
        break;
    }
  }
  useShop.setState({ upgrades: upgrades.map((u) => ({ ...u, level: 0 })) });
  localStorage.removeItem(DEBUG_LEVELS_KEY);
}
