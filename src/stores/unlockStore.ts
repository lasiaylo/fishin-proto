import { create } from "zustand";
import { POND_LOCKED, SKY_LOCKED } from "../util/constants";

export type LockableArea = "pond" | "sky";

// Whether each area's tab is usable. Areas whose lock flag is set start closed
// and are opened by their UNLOCK_* shop upgrade.
export const useUnlocks = create<Record<LockableArea, boolean>>(() => ({
  pond: !POND_LOCKED,
  sky: !SKY_LOCKED,
}));

export function setAreaUnlocked(area: LockableArea, bought: boolean) {
  const locked = area === "pond" ? POND_LOCKED : SKY_LOCKED;
  useUnlocks.setState({ [area]: !locked || bought });
}
