import { create } from "zustand";

export interface VentureState {
  isVenture: boolean;
  stamina: number;
  capacity: number;
}

export const useVenture = create<VentureState>(() => ({
  isVenture: true,
  stamina: 5,
  capacity: 5,
}));

export function setIsVenture(val: boolean) {
  useVenture.setState((_) => ({ isVenture: val }));
}

export function addStamina(val: number) {
  useVenture.setState((s) => {
    const { stamina } = s;
    const newStamina = Math.min(s.capacity, Math.max(0, stamina + val));
    return {
      ...s,
      isVenture: newStamina > 0,
      stamina: newStamina <= 0 ? s.capacity : newStamina,
    };
  });
}
