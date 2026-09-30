import { create } from "zustand";

export type ActionTab = "fields" | "pond" | "sky";

// Shared so the shop can show the upgrades for whichever action tab is open.
export const useActiveTab = create<{ tab: ActionTab }>(() => ({
  tab: "pond",
}));

export function setActiveTab(tab: ActionTab) {
  useActiveTab.setState({ tab });
}
