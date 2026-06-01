import { create } from "zustand";
import {
  FishData,
  loadLocationDisplayData,
  loadLocationGameplayData,
} from "../util/csvLoader";
import { useFish } from "./fishStore";
import { usePlayer } from "./playerStore";

export interface LocationEntry {
  name: string;
  description: string;
  fish: { fishId: string; percent: number }[];
}

type LocationState = Record<string, LocationEntry>;

export const useLocation = create<LocationState>(() => ({}));

export async function initLocations() {
  const [displayData, gameplayData] = await Promise.all([
    loadLocationDisplayData(),
    loadLocationGameplayData(),
  ]);

  const locations: LocationState = {};
  for (const d of displayData) {
    locations[d.id] = { name: d.name, description: d.description, fish: [] };
  }
  for (const entry of gameplayData) {
    locations[entry.locationId]?.fish.push({
      fishId: entry.fishId,
      percent: entry.percent,
    });
  }

  useLocation.setState(locations, true);
}

export function pickFishAtSpot(locationId: string): FishData | null {
  const location = useLocation.getState()[locationId];
  if (!location) return null;

  const { allFish } = useFish.getState();
  const { selectedLure } = usePlayer.getState();
  const effectiveLure = selectedLure ?? "";

  const candidates = location.fish.flatMap(({ fishId, percent }) => {
    const fish = allFish.find((f) => f.id === fishId);
    return fish && fish.requiredLure === effectiveLure
      ? [{ fish, percent }]
      : [];
  });

  if (candidates.length === 0) return null;

  const total = candidates.reduce((sum, c) => sum + c.percent, 0);
  let rand = Math.random() * total;
  for (const c of candidates) {
    rand -= c.percent;
    if (rand <= 0) return c.fish;
  }
  return candidates[candidates.length - 1].fish;
}
