import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { FishData } from "../util/csvLoader";
import {
  BAIT_MAX_STACK,
  getTackleType,
  INITIAL_PLAYER_STATE,
  Rarity,
  Rod,
  TackleType,
} from "../util/constants";

export interface PlayerStats {
  lineHP: number;
  inventorySize: number;
  incomeBoostPercent: number;
}

export interface InventoryFish {
  fish: FishData;
  effectivePrice: number;
  rarity: Rarity;
}

export interface PlayerState extends PlayerStats {
  wallet: number;
  ownedLures: Set<string>;
  baitInventory: Record<string, number>;
  ownedRods: Rod[];
  rodSlotAssignments: (string | null)[];
  rodSlotItems: (string | null)[];
  inventory: InventoryFish[];
}

export const usePlayer = create(
  subscribeWithSelector<PlayerState>(() => ({
    ...INITIAL_PLAYER_STATE,
  })),
);

export const getWallet = () => usePlayer.getState().wallet;

export function addMoney(amount: number) {
  usePlayer.setState((s) => ({ wallet: s.wallet + amount }));
}

export function setMoney(amount: number) {
  usePlayer.setState({ wallet: amount });
}

export function deductMoney(amount: number) {
  usePlayer.setState((s) => ({ wallet: Math.max(0, s.wallet - amount) }));
}

export function setStat(stat: string, value: number) {
  usePlayer.setState((s) => ({ ...s, [stat]: value }));
}

export function addToStat(stat: keyof PlayerStats, value: number) {
  usePlayer.setState((s) => ({ ...s, [stat]: s[stat] + value }));
}

export function addLure(lureId: string) {
  usePlayer.setState((s) => {
    const lures = new Set(s.ownedLures);
    lures.add(lureId);
    return { ownedLures: lures };
  });
}

export function removeLure(lureId: string) {
  usePlayer.setState((s) => {
    const lures = new Set(s.ownedLures);
    lures.delete(lureId);
    return { ownedLures: lures };
  });
}

export function consumeBait(id: string) {
  usePlayer.setState((s) => ({
    baitInventory: {
      ...s.baitInventory,
      [id]: Math.max(0, (s.baitInventory[id] ?? 0) - 1),
    },
  }));
}

export function addBait(id: string, qty: number) {
  usePlayer.setState((s) => ({
    baitInventory: {
      ...s.baitInventory,
      [id]: Math.min(BAIT_MAX_STACK, (s.baitInventory[id] ?? 0) + qty),
    },
  }));
}

export function addRod(id: string) {
  usePlayer.setState((s) => {
    if (s.ownedRods.some((r) => r.id === id)) return s;
    return {
      ownedRods: [...s.ownedRods, { id, attackLevel: 0, defenseLevel: 0 }],
    };
  });
}

export function addRodSlot() {
  usePlayer.setState((s) => ({
    rodSlotAssignments: [...s.rodSlotAssignments, null],
    rodSlotItems: [...s.rodSlotItems, null],
  }));
}

export function assignRodToSlot(slotIdx: number, rodId: string | null) {
  usePlayer.setState((s) => {
    const arr = [...s.rodSlotAssignments];
    arr[slotIdx] = rodId;
    return { rodSlotAssignments: arr };
  });
}

export function setRodLevel(
  rodId: string,
  stat: "attackLevel" | "defenseLevel",
  level: number,
) {
  usePlayer.setState((s) => {
    const idx = s.ownedRods.findIndex((r) => r.id === rodId);
    if (idx === -1) return s;
    const newRods = [...s.ownedRods];
    newRods[idx] = { ...newRods[idx], [stat]: level };
    return { ownedRods: newRods };
  });
}

export function setSlotItem(slotIdx: number, itemId: string | null) {
  usePlayer.setState((s) => {
    if (
      itemId !== null &&
      getTackleType(itemId) === TackleType.LURE &&
      s.rodSlotItems.some((item, i) => i !== slotIdx && item === itemId)
    ) {
      return s;
    }
    const arr = [...s.rodSlotItems];
    arr[slotIdx] = itemId;
    return { rodSlotItems: arr };
  });
}

export function addFishToInventory(fish: FishData, effectivePrice: number) {
  usePlayer.setState((s) => {
    if (s.inventory.length >= s.inventorySize) return s;
    return {
      inventory: [
        ...s.inventory,
        { fish, effectivePrice, rarity: fish.rarity ?? Rarity.COMMON },
      ],
    };
  });
}

export function sellAllFish() {
  const { inventory } = usePlayer.getState();
  const total = inventory.reduce((sum, f) => sum + f.effectivePrice, 0);
  usePlayer.setState((s) => ({ inventory: [], wallet: s.wallet + total }));
}
