import { UpgradeT, useUpgrade } from "./upgradeStore";
import { useShallow } from "zustand/react/shallow";
import _ from "lodash";
import { create } from "zustand";
import { clamp } from "../util/util";

export interface DelivererStat {
  travelTime: number;
  population: number;
  loadSpeed: number;
}

export interface DelivererTravel {
  mult: number;
}

export const BASE_TRAVEL_TIME = 8;
const LOAD_SPEED = 0.75;

export function useDelivererStat(): DelivererStat {
  const upgrades = useUpgrade(
    useShallow((s) =>
      _.mapValues(
        _.pick(s, [UpgradeT.Population, UpgradeT.Parks]),
        (val) => val.amount,
      ),
    ),
  );
  const speed = useSpeed((s) => s.mult);
  return {
    travelTime: BASE_TRAVEL_TIME - 0.1 * speed,
    population: upgrades[UpgradeT.Population] + 1,
    loadSpeed: LOAD_SPEED,
  };
}

const MAX_SPEED = 30;
export const useSpeed = create<DelivererTravel>(() => ({
  mult: 0,
}));

export function addSpeed(delta: number) {
  useSpeed.setState(({ mult }) => {
    return { mult: clamp(mult + delta, 0, MAX_SPEED) };
  });
}
