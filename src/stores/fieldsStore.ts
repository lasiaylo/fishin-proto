import { create } from "zustand";
import { addMoney } from "./playerStore";
import { FIELDS_WIND_COOLDOWN_MS, FIELDS_WIND_PAYOUT } from "../util/constants";

interface FieldsState {
  readyAt: number;
  // Upgradable via the fields shop; start at the base constants.
  payout: number;
  cooldownMs: number;
}

export const useFields = create<FieldsState>(() => ({
  readyAt: 0,
  payout: FIELDS_WIND_PAYOUT,
  cooldownMs: FIELDS_WIND_COOLDOWN_MS,
}));

const MIN_WIND_COOLDOWN_MS = 500;

export function canWind(): boolean {
  return Date.now() >= useFields.getState().readyAt;
}

// Each gust pays its payout straight into the wallet.
export function wind() {
  if (!canWind()) return;
  const { payout, cooldownMs } = useFields.getState();
  useFields.setState({ readyAt: Date.now() + cooldownMs });
  addMoney(payout);
}

export function setWindPayout(amount: number) {
  useFields.setState({ payout: Math.max(0, Math.round(amount)) });
}

export function setWindCooldownMs(ms: number) {
  useFields.setState({ cooldownMs: Math.max(MIN_WIND_COOLDOWN_MS, ms) });
}
