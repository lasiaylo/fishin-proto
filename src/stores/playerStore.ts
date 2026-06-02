import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { FishData } from "../util/csvLoader";

export interface PlayerStats {
  attack: number;
  defense: number;
  lineHP: number;
  inventorySize: number;
}
export interface PlayerState extends PlayerStats {
  wallet: number;
  ownedLures: Set<string>;
  selectedLure: string | null;
  inventory: FishData[];
}

export const INITIAL_PLAYER_STATE: PlayerState = {
  wallet: 0,
  attack: 10,
  defense: 10,
  lineHP: 10,
  inventorySize: 3,
  ownedLures: new Set<string>(),
  selectedLure: null,
  inventory: [],
};

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

export function setSelectedLure(lureId: string | null) {
  usePlayer.setState({ selectedLure: lureId });
}

export function addFishToInventory(fish: FishData) {
  usePlayer.setState((s) => {
    if (s.inventory.length >= s.inventorySize) return s;
    return { inventory: [...s.inventory, fish] };
  });
}

export function sellAllFish() {
  const { inventory } = usePlayer.getState();
  const total = inventory.reduce((sum, f) => sum + f.basePrice, 0);
  usePlayer.setState((s) => ({ inventory: [], wallet: s.wallet + total }));
}
