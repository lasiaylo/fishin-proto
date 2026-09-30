import { create } from "zustand";
import { FishData } from "../util/csvLoader";
import { Rarity, RARITY_COLOR } from "../util/constants";
import { EventMsg } from "../util/eventMessages";
import { addMoney, usePlayer } from "./playerStore";
import { pushEvent } from "./eventLogStore";
import { incrementTotalFishCaught } from "./metricsStore";
import { useSessionLog } from "./sessionLogStore";

// Coordinates are px relative to the pond image box. A caught fish blows out
// of the pond from origin to (x, y), where it floats until the player hovers
// it, then flies to the wallet and pays out.
export interface PondFish {
  id: number;
  fish: FishData;
  effectivePrice: number;
  rarity: Rarity;
  originX: number;
  originY: number;
  x: number;
  y: number;
}

interface PondFishState {
  fish: PondFish[];
}

export const usePondFish = create<PondFishState>(() => ({
  fish: [],
}));

const POND_CENTER = 332 / 2;
// Fish surface within this radius of the pond's center…
const ORIGIN_RADIUS_MAX = 60;
// …and blow outward to land in a ring around the pond's edge.
const LAND_RADIUS_MIN = 120;
const LAND_RADIUS_MAX = 210;

let nextPondFishId = 0;

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function blowOutPath() {
  const angle = Math.random() * Math.PI * 2;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const origin = randomBetween(0, ORIGIN_RADIUS_MAX);
  const land = randomBetween(LAND_RADIUS_MIN, LAND_RADIUS_MAX);
  return {
    originX: POND_CENTER + dx * origin,
    originY: POND_CENTER + dy * origin,
    x: POND_CENTER + dx * land,
    y: POND_CENTER + dy * land,
  };
}

function rarityEvent(msg: string[], rarity: Rarity | undefined) {
  pushEvent(
    msg[0],
    msg[1],
    rarity ? RARITY_COLOR[rarity] : undefined,
    rarity === Rarity.LEGENDARY,
  );
}

export function spawnPondFish(fish: FishData, effectivePrice: number) {
  const rarity = fish.rarity ?? Rarity.COMMON;
  usePondFish.setState((s) => ({
    fish: [
      ...s.fish,
      {
        id: nextPondFishId++,
        fish,
        effectivePrice,
        rarity,
        ...blowOutPath(),
      },
    ],
  }));
  rarityEvent(EventMsg.CAUGHT(fish.name), fish.rarity);
  incrementTotalFishCaught();
}

// Removes the fish from the pond; returns it, or undefined if it was already
// collected.
export function collectPondFish(id: number): PondFish | undefined {
  const item = usePondFish.getState().fish.find((f) => f.id === id);
  if (!item) return undefined;
  usePondFish.setState((s) => ({ fish: s.fish.filter((f) => f.id !== id) }));
  return item;
}

export function depositPondFish(item: PondFish) {
  const { wallet, fishPerRound, incomeBoostPercent } = usePlayer.getState();
  // A session-log round closes once fishPerRound catches have been paid out.
  const sessionLog = useSessionLog.getState();
  if (sessionLog.catches.length >= fishPerRound) {
    sessionLog.finalizeRound(wallet, { fishPerRound, incomeBoostPercent });
  }
  addMoney(item.effectivePrice);
  rarityEvent(
    EventMsg.SOLD_FISH(item.fish.name, item.effectivePrice),
    item.rarity,
  );
}
