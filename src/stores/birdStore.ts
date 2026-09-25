import { create } from "zustand";
import { addMoney } from "./playerStore";
import { lerp } from "../util/easing";
import {
  BIRD_COUNT,
  BIRD_CYCLE_MAX_MS,
  BIRD_CYCLE_MIN_MS,
  BIRD_STAGGER_MS,
  FEATHER_BONUS_PER_BIRD,
  OBSERVE_COOLDOWN_MS,
} from "../util/constants";

interface BirdState {
  // Fixed per-bird away/landed half-period, longest first. Bird i is away
  // for cycles[i] ms, then landed for cycles[i] ms, forever.
  cycles: number[];
  // The timestamp each bird's away phase last began. Whether a bird is
  // landed at any moment t is a pure function of (t, anchor, cycle) — there
  // is nothing to tick, so the flock keeps "flying" correctly whether or
  // not anything is mounted to look at it.
  anchors: number[];
  observeReadyAt: number;
}

const cycles = Array.from({ length: BIRD_COUNT }, (_, i) =>
  lerp(BIRD_CYCLE_MAX_MS, BIRD_CYCLE_MIN_MS, i / (BIRD_COUNT - 1)),
);

// Every bird starts away; bird i's first landing is at (i+1) * stagger, so
// the flock trickles in instead of all ten landing on the opening frame.
function initialAnchors(now: number): number[] {
  return cycles.map((cycle, i) => now + (i + 1) * BIRD_STAGGER_MS - cycle);
}

export const useBirds = create<BirdState>(() => ({
  cycles,
  anchors: initialAnchors(Date.now()),
  observeReadyAt: 0,
}));

function isLanded(anchor: number, cycle: number, t: number): boolean {
  const period = 2 * cycle;
  const phase = (((t - anchor) % period) + period) % period;
  return phase >= cycle;
}

export function birdsLandedAt(t: number): boolean[] {
  const { cycles, anchors } = useBirds.getState();
  return anchors.map((anchor, i) => isLanded(anchor, cycles[i], t));
}

export function landedCountAt(t: number): number {
  return birdsLandedAt(t).filter(Boolean).length;
}

export function canObserve(): boolean {
  return Date.now() >= useBirds.getState().observeReadyAt;
}

function featherPayout(birdCount: number): number {
  return Math.round(birdCount * (1 + FEATHER_BONUS_PER_BIRD * (birdCount - 1)));
}

// Scatters every bird landed at press-time (its away phase restarts), pays
// out, and starts the shared cooldown. Birds already away are untouched and
// keep their own timing.
export function observe(): { birdCount: number; payout: number } {
  if (!canObserve()) return { birdCount: 0, payout: 0 };
  const now = Date.now();
  const { cycles, anchors } = useBirds.getState();
  const landed = anchors.map((anchor, i) => isLanded(anchor, cycles[i], now));
  const birdCount = landed.filter(Boolean).length;
  const payout = featherPayout(birdCount);
  useBirds.setState({
    anchors: anchors.map((anchor, i) => (landed[i] ? now : anchor)),
    observeReadyAt: now + OBSERVE_COOLDOWN_MS,
  });
  if (payout > 0) addMoney(payout);
  return { birdCount, payout };
}
