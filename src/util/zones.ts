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

const avgZoneDistanceCache = new Map<string, number>();

export function avgZoneDistance(zones: Zone[]): number {
  if (zones.length === 0) return 50;

  const key = [...new Set(zones)].sort().join(",");
  const cached = avgZoneDistanceCache.get(key);
  if (cached !== undefined) return cached;

  const mins = zones.map((z) => ZONE_RANGES[z][0]);
  const maxs = zones.map((z) => ZONE_RANGES[z][1]);
  const min = Math.min(...mins);
  const max = Math.max(...maxs);

  // Bites are checked every BITE_CHECK_INTERVAL while reeling in from `max`
  // down to `min`, at a constant per-check probability. That makes an
  // earlier (farther) check more likely to land the bite than a later
  // (closer) one, so the expected bite distance skews toward `max` rather
  // than sitting at the flat midpoint.
  const numChecks = Math.max(1, Math.round((max - min) / BITE_CHECK_INTERVAL));
  const p = perCheckProbability(TARGET_BITE_CHANCE, numChecks);

  let weightSum = 0;
  let distanceSum = 0;
  for (let k = 0; k < numChecks; k++) {
    const weight = (1 - p) ** k * p;
    const distance = max - k * BITE_CHECK_INTERVAL;
    weightSum += weight;
    distanceSum += weight * distance;
  }
  const result = weightSum > 0 ? distanceSum / weightSum : (min + max) / 2;
  avgZoneDistanceCache.set(key, result);
  return result;
}
