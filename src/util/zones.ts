import { perCheckProbability } from "./random";
import {
  BITE_CHANCE_INCREMENT,
  BITE_CHECK_INTERVAL,
  LURE_BITE_CHANCE_PER_LEVEL,
  TARGET_BITE_CHANCE,
  Zone,
  ZONE_RANGES,
} from "./constants";

export function getBiteChance(zones: Zone[], emptyReelCount: number, lureLevel = 0): number {
  const target = Math.min(
    TARGET_BITE_CHANCE + lureLevel * LURE_BITE_CHANCE_PER_LEVEL + BITE_CHANCE_INCREMENT * emptyReelCount,
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

function zonesAtDistance(
  distance: number,
  ranges: Record<Zone, [number, number]>,
): Zone[] {
  return [Zone.CLOSE, Zone.MID, Zone.FAR].filter((zone) => {
    const [min, max] = ranges[zone];
    return distance >= min && distance <= max;
  });
}

export function getZones(distance: number): Zone[] {
  return zonesAtDistance(distance, ZONE_RANGES);
}

export function avgZoneDistance(zones: Zone[]): number {
  if (zones.length === 0) return 50;
  const mins = zones.map((z) => ZONE_RANGES[z][0]);
  const maxs = zones.map((z) => ZONE_RANGES[z][1]);
  return (Math.min(...mins) + Math.max(...maxs)) / 2;
}
