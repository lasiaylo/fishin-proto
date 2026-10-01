import { create } from "zustand";
import { POND_LOCKED } from "../util/constants";

export type ActionTab = "fields" | "pond" | "sky";

// Shared so the shop can show the upgrades for whichever action tab is open.
export const useActiveTab = create<{ tab: ActionTab }>(() => ({
  // A locked pond starts the player out in the fields.
  tab: POND_LOCKED ? "fields" : "pond",
}));

export function setActiveTab(tab: ActionTab) {
  useActiveTab.setState({ tab });
}
