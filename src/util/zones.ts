export enum Zone {
  CLOSE = "CLOSE",
  MID = "MID",
  FAR = "FAR",
}

export const ZONE_RANGES: Record<Zone, [number, number]> = {
  [Zone.CLOSE]: [1, 20],
  [Zone.MID]: [21, 50],
  [Zone.FAR]: [50, 80],
};

import { perCheckProbability } from "./random";

export const BITE_CHECK_INTERVAL = 1;

// Target probability of getting at least one bite while reeling through a zone.
export const TARGET_BITE_CHANCE = 0.7;
export const BITE_CHANCE_INCREMENT = 0.05;

export function getBiteChance(zones: Zone[], emptyReelCount: number): number {
  const target = Math.min(
    TARGET_BITE_CHANCE + BITE_CHANCE_INCREMENT * emptyReelCount,
    1,
  );
  return Math.max(
    ...zones.map((z) => {
      const [min, max] = ZONE_RANGES[z];
      const n = (max - min) / BITE_CHECK_INTERVAL;
      return perCheckProbability(target, n);
    }),
  );
}

export function getZones(distance: number): Zone[] {
  return [Zone.CLOSE, Zone.MID, Zone.FAR].filter((zone) => {
    const [min, max] = ZONE_RANGES[zone];
    return distance >= min && distance <= max;
  });
}

export function avgZoneDistance(zones: Zone[]): number {
  if (zones.length === 0) return 50;
  const mins = zones.map((z) => ZONE_RANGES[z][0]);
  const maxs = zones.map((z) => ZONE_RANGES[z][1]);
  return (Math.min(...mins) + Math.max(...maxs)) / 2;
}
