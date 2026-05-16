import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { usePlayer } from "./playerStore";

export interface CaughtFish {
  name: string;
  basePrice: number;
}

interface InventoryState {
  fish: CaughtFish[];
}

export const useInventory = create(
  subscribeWithSelector<InventoryState>(() => ({
    fish: [],
  })),
);

export function addFish(fish: CaughtFish): boolean {
  const capacity = usePlayer.getState().inventoryCapacity;
  const current = useInventory.getState().fish;
  if (current.length >= capacity) return false;
  useInventory.setState({ fish: [...current, fish] });
  return true;
}

export function clearInventory() {
  useInventory.setState({ fish: [] });
}

export function getInventoryCount() {
  return useInventory.getState().fish.length;
}

export function isFull() {
  const capacity = usePlayer.getState().inventoryCapacity;
  return useInventory.getState().fish.length >= capacity;
}

export function getTotalFishValue() {
  return useInventory
    .getState()
    .fish.reduce((sum, f) => sum + f.basePrice, 0);
}
