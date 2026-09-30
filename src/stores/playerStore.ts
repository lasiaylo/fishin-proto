import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import {
  BAIT_MAX_STACK,
  getTackleType,
  INITIAL_PLAYER_STATE,
  Rod,
  TackleType,
} from "../util/constants";
import { useDebugSettings } from "./debugSettingsStore";

export interface PlayerStats {
  // Catches per session-log round (a shop checkpoint in the economy model).
  fishPerRound: number;
  incomeBoostPercent: number;
}

export interface PlayerState extends PlayerStats {
  wallet: number;
  ownedLures: Set<string>;
  baitInventory: Record<string, number>;
  ownedRods: Rod[];
  rodSlotAssignments: (string | null)[];
  rodSlotItems: (string | null)[];
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

// There is only ever one rod slot now, so a debug save from before that was
// true must not be able to bring a second one back — truncate to length 1
// regardless of what was persisted.
export function restorePersistedRodSlots() {
  if (!useDebugSettings.getState().persistRodSlots) return;
  const raw = localStorage.getItem(ROD_SLOT_STORAGE_KEY);
  if (!raw) return;
  try {
    const { assignments, items }: PersistedRodSlots = JSON.parse(raw);
    usePlayer.setState({
      rodSlotAssignments: assignments.slice(0, 1),
      rodSlotItems: items.slice(0, 1),
    });
  } catch {
    // malformed persisted data, ignore
  }
}
