import { create } from "zustand";

const PERSIST_ROD_SLOTS_KEY = "debug_persist_rod_slots";

interface DebugSettingsState {
  persistRodSlots: boolean;
}

export const useDebugSettings = create<DebugSettingsState>(() => ({
  persistRodSlots: localStorage.getItem(PERSIST_ROD_SLOTS_KEY) === "true",
}));

export function setPersistRodSlots(enabled: boolean) {
  localStorage.setItem(PERSIST_ROD_SLOTS_KEY, String(enabled));
  useDebugSettings.setState({ persistRodSlots: enabled });
}
