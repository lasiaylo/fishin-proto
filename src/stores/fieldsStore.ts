import { create } from "zustand";
import { addMoney } from "./playerStore";
import { incrementTotalSits } from "./metricsStore";
import { FIELDS_SIT_COOLDOWN_MS, FIELDS_SIT_PAYOUT } from "../util/constants";

interface FieldsState {
  readyAt: number;
  // Upgradable via the fields shop; start at the base constants.
  payout: number;
  cooldownMs: number;
}

export const useFields = create<FieldsState>(() => ({
  readyAt: 0,
  payout: FIELDS_SIT_PAYOUT,
  cooldownMs: FIELDS_SIT_COOLDOWN_MS,
}));

const MIN_SIT_COOLDOWN_MS = 500;

export function canSit(): boolean {
  return Date.now() >= useFields.getState().readyAt;
}

// Each sit pays its payout straight into the wallet.
export function sit() {
  if (!canSit()) return;
  const { payout, cooldownMs } = useFields.getState();
  useFields.setState({ readyAt: Date.now() + cooldownMs });
  addMoney(payout);
  incrementTotalSits();
}

export function setSitPayout(amount: number) {
  useFields.setState({ payout: Math.max(0, Math.round(amount)) });
}

export function setSitCooldownMs(ms: number) {
  useFields.setState({ cooldownMs: Math.max(MIN_SIT_COOLDOWN_MS, ms) });
}
