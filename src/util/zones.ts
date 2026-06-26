import { perCheckProbability } from "./random";
import {
  BITE_CHANCE_INCREMENT,
  BITE_CHECK_INTERVAL,
  TARGET_BITE_CHANCE,
  Zone,
  ZONE_RANGES,
} from "./constants";

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
