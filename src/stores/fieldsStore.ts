import { create } from "zustand";
import { addMoney } from "./playerStore";
import { FIELDS_WIND_COOLDOWN_MS, FIELDS_WIND_REWARD } from "../util/constants";

interface FieldsState {
  readyAt: number;
}

export const useFields = create<FieldsState>(() => ({
  readyAt: 0,
}));

export function canWind(): boolean {
  return Date.now() >= useFields.getState().readyAt;
}

export function wind() {
  if (!canWind()) return;
  addMoney(FIELDS_WIND_REWARD);
  useFields.setState({ readyAt: Date.now() + FIELDS_WIND_COOLDOWN_MS });
}
