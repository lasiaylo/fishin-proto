import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { ShopUpgradeData, StatName } from "../util/csvLoader";
import {
  addBait,
  addLure,
  addRod,
  addRodSlot,
  setRodLevel,
  addToStat,
  removeLure,
} from "./playerStore";
import { useSessionLog } from "./sessionLogStore";

export interface UpgradeEntry extends ShopUpgradeData {
  level: number;
}

interface UpgradeState {
  upgrades: UpgradeEntry[];
}

export interface UpgradeStoreOptions {
  storageKey: string;
  getCurrency: () => number;
  deductCurrency: (amount: number) => void;
}

function applyStatEffect(upgrade: UpgradeEntry, level: number, delta: number) {
  switch (upgrade.stat) {
    case StatName.LURE:
      if (level > 0) addLure(upgrade.id);
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
      setRodLevel(rodId, "attackLevel", level);
      break;
    }
    case StatName.ROD_DEFENSE: {
      const rodId = upgrade.id.replace("_DEFENSE", "");
      setRodLevel(rodId, "defenseLevel", level);
      break;
    }
  }
}

export function createUpgradeStore({
  storageKey,
  getCurrency,
  deductCurrency,
}: UpgradeStoreOptions) {
  const useUpgradeStore = create(
    subscribeWithSelector<UpgradeState>(() => ({
      upgrades: [],
    })),
  );

  function loadPersistedLevels(): Record<string, number> {
    try {
      return JSON.parse(localStorage.getItem(storageKey) ?? "{}");
    } catch {
      return {};
    }
  }

  function persistLevels(upgrades: UpgradeEntry[]) {
    const map: Record<string, number> = {};
    for (const u of upgrades) {
      if (u.level > 0) map[u.id] = u.level;
    }
    localStorage.setItem(storageKey, JSON.stringify(map));
  }

  function initShopFromData(data: ShopUpgradeData[]) {
    const upgrades = data.map((d) => ({ ...d, level: 0 }));
    useUpgradeStore.setState({ upgrades });

    const saved = loadPersistedLevels();
    for (const [id, level] of Object.entries(saved)) {
      setUpgradeLevelDebug(id, level);
    }
  }

  function getUpgradePrice(upgrade: UpgradeEntry): number | null {
    if (upgrade.level >= upgrade.prices.length) return null;
    return upgrade.prices[upgrade.level];
  }

  function canAffordUpgrade(upgrade: UpgradeEntry): boolean {
    const price = getUpgradePrice(upgrade);
    if (price === null) return false;
    return getCurrency() >= price;
  }

  function isMaxed(upgrade: UpgradeEntry): boolean {
    if (upgrade.stat === StatName.BAIT) {
      return false;
    }
    return upgrade.level >= upgrade.prices.length;
  }

  function buyUpgrade(id: string) {
    const state = useUpgradeStore.getState();
    const idx = state.upgrades.findIndex((u) => u.id === id);
    if (idx === -1) return;

    const upgrade = state.upgrades[idx];
    const price = getUpgradePrice(upgrade);
    if (price === null) return;
    if (getCurrency() < price) return;

    deductCurrency(price);

    // BAIT: consume the purchase but don't increment level
    if (upgrade.stat === StatName.BAIT) {
      addBait(upgrade.id, upgrade.valuePerLevel);
      useSessionLog.getState().logUpgradeBought(upgrade.id, 1, false);
      return;
    }

    const newLevel = upgrade.level + 1;
    applyStatEffect(upgrade, newLevel, 1);

    const newUpgrades = [...state.upgrades];
    newUpgrades[idx] = { ...upgrade, level: newLevel };
    useUpgradeStore.setState({ upgrades: newUpgrades });

    useSessionLog
      .getState()
      .logUpgradeBought(upgrade.id, newLevel, upgrade.stat === StatName.LURE);
  }

  function setUpgradeLevelDebug(id: string, newLevel: number) {
    const state = useUpgradeStore.getState();
    const idx = state.upgrades.findIndex((u) => u.id === id);
    if (idx === -1) return;

    const upgrade = state.upgrades[idx];

    if (upgrade.stat === StatName.BAIT) return; // bait uses inventory count, not levels

    const clamped = Math.max(0, Math.min(newLevel, upgrade.prices.length));
    const delta = clamped - upgrade.level;
    if (delta === 0) return;

    applyStatEffect(upgrade, clamped, delta);

    const newUpgrades = [...state.upgrades];
    newUpgrades[idx] = { ...upgrade, level: clamped };
    useUpgradeStore.setState({ upgrades: newUpgrades });
    persistLevels(newUpgrades);
  }

  function resetAllUpgradesDebug() {
    const { upgrades } = useUpgradeStore.getState();
    for (const u of upgrades) {
      if (u.level === 0) continue;
      if (u.stat === StatName.BAIT) continue;
      applyStatEffect(u, 0, -u.level);
    }
    useUpgradeStore.setState({
      upgrades: upgrades.map((u) => ({ ...u, level: 0 })),
    });
    localStorage.removeItem(storageKey);
  }

  return {
    useUpgradeStore,
    initShopFromData,
    getUpgradePrice,
    canAffordUpgrade,
    isMaxed,
    buyUpgrade,
    setUpgradeLevelDebug,
    resetAllUpgradesDebug,
  };
}
