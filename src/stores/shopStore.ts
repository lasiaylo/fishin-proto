import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import {
  ShopUpgradeData,
  StatName,
  loadShopData,
  loadShopDisplayMap,
  parseShopGameplayRows,
} from "../util/csvLoader";
import {
  addBait,
  addLure,
  addRod,
  addRodSlot,
  setRodLevel,
  addToStat,
  deductMoney,
  getWallet,
  removeLure,
  usePlayer,
} from "./playerStore";
import { BAIT_MAX_STACK } from "../util/constants";
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

export async function initShopFromRows(rows: string[][]) {
  const displayMap = await loadShopDisplayMap();
  initShopFromData(parseShopGameplayRows(rows, displayMap));
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
  if (upgrade.stat === StatName.BAIT) {
    return false;
  }
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

  // BAIT: consume the purchase but don't increment level
  if (upgrade.stat === StatName.BAIT) {
    addBait(upgrade.id, upgrade.valuePerLevel);
    useSessionLog.getState().logUpgradeBought(upgrade.id, 1, false);
    return;
  }

  const newLevel = upgrade.level + 1;

  switch (upgrade.stat) {
    case StatName.LURE:
      addLure(upgrade.id);
      break;
    case StatName.HP:
      addToStat("lineHP", upgrade.valuePerLevel);
      break;
    case StatName.INVENTORY:
      addToStat("inventorySize", upgrade.valuePerLevel);
      break;
    case StatName.ROD:
      addRod(upgrade.id);
      break;
    case StatName.ROD_SLOT:
      addRodSlot();
      break;
    case StatName.ROD_ATTACK: {
      const rodId = upgrade.id.replace("_ATTACK", "");
      setRodLevel(rodId, "attackLevel", newLevel);
      break;
    }
    case StatName.ROD_DEFENSE: {
      const rodId = upgrade.id.replace("_DEFENSE", "");
      setRodLevel(rodId, "defenseLevel", newLevel);
      break;
    }
  }

  const newUpgrades = [...state.upgrades];
  newUpgrades[idx] = { ...upgrade, level: newLevel };
  useShop.setState({ upgrades: newUpgrades });

  useSessionLog
    .getState()
    .logUpgradeBought(upgrade.id, newLevel, upgrade.stat === StatName.LURE);
}

export function setUpgradeLevelDebug(id: string, newLevel: number) {
  const state = useShop.getState();
  const idx = state.upgrades.findIndex((u) => u.id === id);
  if (idx === -1) return;

  const upgrade = state.upgrades[idx];

  if (upgrade.stat === StatName.BAIT) return; // bait uses inventory count, not levels

  const clamped = Math.max(0, Math.min(newLevel, upgrade.prices.length));
  const delta = clamped - upgrade.level;
  if (delta === 0) return;

  switch (upgrade.stat) {
    case StatName.LURE:
      if (clamped > 0) addLure(upgrade.id);
      else removeLure(upgrade.id);
      break;
    case StatName.HP:
      addToStat("lineHP", delta * upgrade.valuePerLevel);
      break;
    case StatName.INVENTORY:
      addToStat("inventorySize", delta * upgrade.valuePerLevel);
      break;
    case StatName.ROD:
      if (delta > 0) addRod(upgrade.id);
      break;
    case StatName.ROD_SLOT:
      if (delta > 0) addRodSlot();
      break;
    case StatName.ROD_ATTACK: {
      const rodId = upgrade.id.replace("_ATTACK", "");
      setRodLevel(rodId, "attackLevel", clamped);
      break;
    }
    case StatName.ROD_DEFENSE: {
      const rodId = upgrade.id.replace("_DEFENSE", "");
      setRodLevel(rodId, "defenseLevel", clamped);
      break;
    }
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
    if (u.stat === StatName.BAIT) continue;
    const delta = -u.level;
    switch (u.stat) {
      case StatName.LURE:
        removeLure(u.id);
        break;
      case StatName.HP:
        addToStat("lineHP", delta * u.valuePerLevel);
        break;
      case StatName.INVENTORY:
        addToStat("inventorySize", delta * u.valuePerLevel);
        break;
      case StatName.ROD_ATTACK: {
        const rodId = u.id.replace("_ATTACK", "");
        setRodLevel(rodId, "attackLevel", 0);
        break;
      }
      case StatName.ROD_DEFENSE: {
        const rodId = u.id.replace("_DEFENSE", "");
        setRodLevel(rodId, "defenseLevel", 0);
        break;
      }
    }
  }
  useShop.setState({ upgrades: upgrades.map((u) => ({ ...u, level: 0 })) });
  localStorage.removeItem(DEBUG_LEVELS_KEY);
}
