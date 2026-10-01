import { create } from "zustand";
import { addMoney } from "./playerStore";
import {
  FIELDS_WIND_COOLDOWN_MS,
  FIELDS_WIND_PARTICLE_COUNT,
  FIELDS_WIND_PARTICLE_VALUE,
} from "../util/constants";

interface FieldsState {
  readyAt: number;
  // Upgradable via the fields shop; start at the base constants.
  particleCount: number;
  cooldownMs: number;
}

export const useFields = create<FieldsState>(() => ({
  readyAt: 0,
  particleCount: FIELDS_WIND_PARTICLE_COUNT,
  cooldownMs: FIELDS_WIND_COOLDOWN_MS,
}));

const MIN_WIND_COOLDOWN_MS = 500;

export function canWind(): boolean {
  return Date.now() >= useFields.getState().readyAt;
}

// Each gust pays out its particles straight into the wallet.
export function wind() {
  if (!canWind()) return;
  const { particleCount, cooldownMs } = useFields.getState();
  useFields.setState({ readyAt: Date.now() + cooldownMs });
  addMoney(particleCount * FIELDS_WIND_PARTICLE_VALUE);
}

export function setWindParticleCount(count: number) {
  useFields.setState({ particleCount: Math.max(0, Math.round(count)) });
}

export function setWindCooldownMs(ms: number) {
  useFields.setState({ cooldownMs: Math.max(MIN_WIND_COOLDOWN_MS, ms) });
}
