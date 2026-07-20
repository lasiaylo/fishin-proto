import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { FishData } from "../util/csvLoader";
import {
  BAIT_MAX_STACK,
  getTackleType,
  INITIAL_PLAYER_STATE,
  Rarity,
  RARITY_COLOR,
  Rod,
  TackleType,
} from "../util/constants";
import { incrementTotalFishCaught } from "./metricsStore";
import { EventMsg } from "../util/eventMessages";
import { pushEvent } from "./eventLogStore";
import { useDebugSettings } from "./debugSettingsStore";

export interface PlayerStats {
  inventorySize: number;
  incomeBoostPercent: number;
}

export interface InventoryFish {
  fish: FishData;
  effectivePrice: number;
  rarity: Rarity;
  locked: boolean;
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

export function setBaitCount(id: string, count: number) {
  usePlayer.setState((s) => ({
    baitInventory: {
      ...s.baitInventory,
      [id]: Math.max(0, Math.min(BAIT_MAX_STACK, count)),
    },
  }));
}

export function addRod(id: string) {
  usePlayer.setState((s) => {
    if (s.ownedRods.some((r) => r.id === id)) return s;
    return {
      ownedRods: [
        ...s.ownedRods,
        { id, attackLevel: 0, defenseLevel: 0, lineHpLevel: 0 },
      ],
    };
  });
}

export function setRodSlotCount(count: number) {
  usePlayer.setState((s) => {
    if (s.rodSlotAssignments.length === count) return s;
    return {
      rodSlotAssignments: Array.from(
        { length: count },
        (_, i) => s.rodSlotAssignments[i] ?? null,
      ),
      rodSlotItems: Array.from(
        { length: count },
        (_, i) => s.rodSlotItems[i] ?? null,
      ),
    };
  });
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
  stat: "attackLevel" | "defenseLevel" | "lineHpLevel",
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

const ROD_SLOT_STORAGE_KEY = "debug_rod_slot_assignments";

interface PersistedRodSlots {
  assignments: (string | null)[];
  items: (string | null)[];
}

usePlayer.subscribe(
  (s) => [s.rodSlotAssignments, s.rodSlotItems] as const,
  ([assignments, items]) => {
    if (!useDebugSettings.getState().persistRodSlots) return;
    localStorage.setItem(
      ROD_SLOT_STORAGE_KEY,
      JSON.stringify({ assignments, items } satisfies PersistedRodSlots),
    );
  },
);

// Must run before shop/dream-shop init: those establish the slot count via
// setRodSlotCount, which preserves whatever is already at each index — so
// restoring first means the upgrade-driven resize naturally keeps these
// assignments (truncating/padding as needed) instead of them being
// overwritten before restore gets a chance to read them back.
export function restorePersistedRodSlots() {
  if (!useDebugSettings.getState().persistRodSlots) return;
  const raw = localStorage.getItem(ROD_SLOT_STORAGE_KEY);
  if (!raw) return;
  try {
    const { assignments, items }: PersistedRodSlots = JSON.parse(raw);
    usePlayer.setState({
      rodSlotAssignments: assignments,
      rodSlotItems: items,
    });
  } catch {
    // malformed persisted data, ignore
  }
}

export function addFishToInventory(fish: FishData, effectivePrice: number) {
  usePlayer.setState((s) => {
    if (s.inventory.length >= s.inventorySize) return s;
    return {
      inventory: [
        ...s.inventory,
        {
          fish,
          effectivePrice,
          rarity: fish.rarity ?? Rarity.COMMON,
          locked: false,
        },
      ],
    };
  });
  const msg = EventMsg.CAUGHT(fish.name);
  pushEvent(
    msg[0],
    msg[1],
    fish.rarity ? RARITY_COLOR[fish.rarity] : undefined,
    fish.rarity === Rarity.LEGENDARY,
  );
  incrementTotalFishCaught();
}

export function toggleFishLock(index: number) {
  usePlayer.setState((s) => {
    const item = s.inventory[index];
    if (!item) return s;
    const inventory = [...s.inventory];
    inventory[index] = { ...item, locked: !item.locked };
    return { inventory };
  });
}

export function removeFishFromInventory(
  index: number,
): InventoryFish | undefined {
  const { inventory } = usePlayer.getState();
  const item = inventory[index];
  if (!item) return undefined;
  usePlayer.setState({
    inventory: inventory.filter((_, i) => i !== index),
  });
  return item;
}

export function sellAllFish() {
  const { inventory } = usePlayer.getState();
  const total = inventory
    .filter((f) => !f.locked)
    .reduce((sum, f) => sum + f.effectivePrice, 0);
  usePlayer.setState((s) => ({
    inventory: s.inventory.filter((f) => f.locked),
    wallet: s.wallet + total,
  }));
}
