export enum Zone {
  CLOSE = "CLOSE",
  MID = "MID",
  FAR = "FAR",
}

export const ZONE_RANGES: Record<Zone, [number, number]> = {
  [Zone.CLOSE]: [5, 30],
  [Zone.MID]: [30, 60],
  [Zone.FAR]: [50, 80],
};

export const BITE_CHECK_INTERVAL = 1;

// Target probability of getting at least one bite while reeling through a zone.
const TARGET_BITE_CHANCE = 0.65;

function perCheckChance(zone: Zone): number {
  const [min, max] = ZONE_RANGES[zone];
  const n = (max - min) / BITE_CHECK_INTERVAL;
  return 1 - (1 - TARGET_BITE_CHANCE) ** (1 / n);
}

export const BITE_CHANCE: Record<Zone, number> = {
  [Zone.CLOSE]: perCheckChance(Zone.CLOSE),
  [Zone.MID]: perCheckChance(Zone.MID),
  [Zone.FAR]: perCheckChance(Zone.FAR),
};

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
