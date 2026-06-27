import { FightEngine, Outcome } from "./FightEngine";
import {
  FishData,
  LocationFishEntry,
  ShopUpgradeData,
  StatName,
} from "../util/csvLoader";
import { avgZoneDistance } from "../util/zones";
import { lerp } from "../util/easing";
import {
  CAST_MIN,
  CAST_DURATION_MIN,
  CAST_DURATION_MAX,
  CAST_CHARGE_DURATION,
  LURING_REEL_MAX_SPEED,
  RESULT_DURATION,
  INITIAL_PLAYER_STATE,
  TARGET_BITE_CHANCE,
  ZONE_RANGES,
  Zone,
} from "../util/constants";
import { PlayerStats } from "../stores/playerStore";
import {
  XP_PER_DISTANCE,
  XP_WIN,
  XP_LOSS,
  computeLureLevel,
  lurePriceMultiplier,
} from "../util/constants";

const EVAL_TRIALS = 100;
const MAX_ROUNDS = 100;

export type UpgradeStrategy =
  | { type: "CHEAPEST_UPGRADE" }
  | { type: "PRIORITIZE_LURE"; lureRoundTrips: number };

export const DEFAULT_UPGRADE_STRATEGY: UpgradeStrategy = {
  type: "CHEAPEST_UPGRADE",
};

export interface EconomyRound {
  round: number;
  cumulativeTime: number;
  roundTime: number;
  fightDuration: number;
  income: number;
  wallet: number; // after income, before upgrades
  rate: number; // $/sec
  lureId: string; // "" = no lure
  fishCatchTimes: Record<string, number>; // fishId → avgFightTime (all fish in chosen lure pool)
  fishEarnings: Record<string, number>; // fishId → avgEarnings considering win rate
  lureRates: Record<string, number>; // lureId → $/s for each accessible lure
  lureWinRates: Record<string, number>; // lureId → win % (0–1)
  lureRemainingHP: Record<string, number>; // lureId → avg remaining line HP on wins
  upgradesBought: string[];
  upgradeLevels: Record<string, number>;
  boughtLure: boolean;
  playerStats: PlayerStats;
  lureLevels: Record<string, number>; // lureId → current level after this round
  lureXp: Record<string, number>; // lureId → cumulative XP after this round
}

// ── Helpers ──

function runTrials(
  fish: FishData,
  player: PlayerStats,
  n: number,
): { winCount: number; avgFightTime: number; avgWinTension: number } {
  const engine = new FightEngine(
    fish.attack,
    fish.defense,
    fish.thrash,
    player.attack,
    player.defense,
    player.lineHP,
    avgZoneDistance(fish.zones),
    fish.hp,
  );
  let winCount = 0;
  let totalWinTime = 0;
  let totalWinTension = 0;

  for (let i = 0; i < n; i++) {
    engine.reset();
    const { outcome, duration } = engine.runToCompletion();
    if (outcome === Outcome.WIN) {
      winCount++;
      totalWinTension += engine.tension;
    }
    totalWinTime += duration;
  }

  return {
    winCount,
    avgFightTime: totalWinTime / n,
    avgWinTension: winCount > 0 ? totalWinTension / winCount : 0,
  };
}

function buildFishWeights(
  fishByLure: Map<string, FishData[]>,
  locationData: LocationFishEntry[],
): Map<string, number> {
  const fishPercent = new Map<string, number>(
    locationData.map((e) => [e.fishId, e.percent]),
  );
  const weights = new Map<string, number>();
  for (const pool of fishByLure.values()) {
    const total = pool.reduce((s, f) => s + (fishPercent.get(f.id) ?? 1), 0);
    for (const f of pool) {
      weights.set(f.id, (fishPercent.get(f.id) ?? 1) / total);
    }
  }
  return weights;
}

function evalLure(
  groups: Map<string, FishData[]>,
  player: PlayerStats,
  ownedLures: Set<string>,
  fishWeights: Map<string, number>,
  evalTrials: number,
  lureXpMap: Record<string, number> = {},
): {
  best: {
    lureId: string;
    avgFightTime: number;
    avgEarningsPerCast: number;
  } | null;
  catchTimes: Record<string, number>;
  earnings: Record<string, number>;
  lureRates: Record<string, number>;
  lureWinRates: Record<string, number>;
  lureRemainingHP: Record<string, number>;
} {
  let bestRate;
  let best = null;
  const catchTimes: Record<string, number> = {};
  const earnings: Record<string, number> = {};
  const lureRates: Record<string, number> = {};
  const lureWinRates: Record<string, number> = {};
  const lureRemainingHP: Record<string, number> = {};

  for (const [lureId, pool] of groups) {
    if (lureId && !ownedLures.has(lureId)) continue;

    const lureLevel = computeLureLevel(lureXpMap[lureId] ?? 0);
    const priceMultiplier = lurePriceMultiplier(lureLevel);

    let totalEarnings = 0;
    let totalFightTime = 0;
    let totalWinRate = 0;
    let totalRemainingHP = 0;

    for (const fish of pool) {
      const { winCount, avgFightTime, avgWinTension } = runTrials(
        fish,
        player,
        evalTrials,
      );
      const weight = fishWeights.get(fish.id) ?? 1 / pool.length;
      catchTimes[fish.id] = avgFightTime;
      const avgEarnings = (fish.basePrice * priceMultiplier * winCount) / evalTrials;
      earnings[fish.id] = avgEarnings / avgFightTime;
      totalEarnings += avgEarnings * weight;
      totalFightTime += avgFightTime * weight;
      totalWinRate += (winCount / evalTrials) * weight;
      totalRemainingHP +=
        ((player.lineHP - avgWinTension) / player.lineHP) * 100 * weight;
    }

    // totalFightTime and totalEarnings are already weighted averages (weights sum to 1)
    if (totalFightTime === 0) continue;

    const avgFightTime = totalFightTime;
    const avgEarningsPerCast = totalEarnings;
    const rate = avgEarningsPerCast / avgFightTime;
    lureRates[lureId] = rate;
    lureWinRates[lureId] = totalWinRate;
    lureRemainingHP[lureId] = totalRemainingHP;

    if (bestRate === undefined || rate >= bestRate) {
      bestRate = rate;
      best = { lureId, avgFightTime, avgEarningsPerCast };
    }
  }

  return {
    best,
    catchTimes,
    earnings,
    lureRates,
    lureWinRates,
    lureRemainingHP,
  };
}

function perCastOverhead(
  castMax: number,
  lureId: string,
  fishByLure: Map<string, FishData[]>,
): number {
  const pool = fishByLure.get(lureId) ?? [];
  const validZones = [...new Set(pool.flatMap((f) => f.zones))];
  const maxZoneDist = Math.max(...validZones.map((z) => ZONE_RANGES[z][1]));
  const effectiveCast = Math.min(castMax, maxZoneDist);
  const castT =
    castMax > CAST_MIN ? (effectiveCast - CAST_MIN) / (castMax - CAST_MIN) : 0;
  const chargeTime = lerp(0, CAST_CHARGE_DURATION / 1000, castT);
  const castAnimDuration = lerp(CAST_DURATION_MIN, CAST_DURATION_MAX, castT);
  const luringTime = expectedLuringTime(effectiveCast);
  return chargeTime + castAnimDuration + luringTime + RESULT_DURATION / 1000;
}

function expectedLuringTime(effectiveCast: number): number {
  const zoneOrder = [Zone.FAR, Zone.MID, Zone.CLOSE];
  let survivalProb = 1;
  let expectedDistance = 0;
  for (const zone of zoneOrder) {
    const [zMin, zMax] = ZONE_RANGES[zone];
    if (effectiveCast < zMin) continue;
    const entryDistance = Math.min(effectiveCast, zMax);
    const reelDistance = entryDistance - zMin;
    expectedDistance += survivalProb * TARGET_BITE_CHANCE * reelDistance;
    survivalProb *= 1 - TARGET_BITE_CHANCE;
  }

  // Chance of going through without any hooks
  expectedDistance += survivalProb * effectiveCast;
  return expectedDistance / LURING_REEL_MAX_SPEED;
}

function cheapestUpgrade(
  shopData: ShopUpgradeData[],
  levels: Record<string, number>,
  wallet: number,
  player: PlayerStats,
): { upgrade: ShopUpgradeData; price: number } | null {
  const statValue = (stat: StatName): number => {
    switch (stat) {
      case StatName.ATTACK:
        return player.attack;
      case StatName.DEFENSE:
        return player.defense;
      case StatName.HP:
        return player.lineHP;
      case StatName.INVENTORY:
        return player.inventorySize;
      case StatName.LURE:
        return 0;
      case StatName.CAST_DISTANCE:
        return player.castMax;
      default:
        return Infinity;
    }
  };

  let best: { upgrade: ShopUpgradeData; price: number } | null = null;

  for (const upgrade of shopData) {
    const level = levels[upgrade.id] ?? 0;
    if (level >= upgrade.prices.length) continue;
    const price = upgrade.prices[level];
    if (price > wallet) continue;

    if (upgrade.stat === StatName.LURE) return { upgrade, price };

    if (best === null) {
      best = { upgrade, price };
      continue;
    }

    if (price < best.price) {
      best = { upgrade, price };
    } else if (
      price === best.price &&
      statValue(upgrade.stat) < statValue(best.upgrade.stat)
    ) {
      best = { upgrade, price };
    }
  }

  return best;
}

function prioritizeLureUpgrade(
  shopData: ShopUpgradeData[],
  levels: Record<string, number>,
  wallet: number,
  player: PlayerStats,
  income: number,
  roundTripsThreshold: number,
): { upgrade: ShopUpgradeData; price: number } | null {
  let cheapestLure: { upgrade: ShopUpgradeData; price: number } | null = null;
  for (const upgrade of shopData) {
    if (upgrade.stat !== StatName.LURE) continue;
    const level = levels[upgrade.id] ?? 0;
    if (level >= upgrade.prices.length) continue;
    const price = upgrade.prices[level];
    if (cheapestLure === null || price < cheapestLure.price) {
      cheapestLure = { upgrade, price };
    }
  }

  if (cheapestLure !== null && income > 0) {
    const roundsNeeded = Math.ceil(
      Math.max(0, cheapestLure.price - wallet) / income,
    );
    if (roundsNeeded <= roundTripsThreshold) {
      if (wallet >= cheapestLure.price) return cheapestLure;
      return null;
    }
  }

  return cheapestUpgrade(shopData, levels, wallet, player);
}

function applyUpgrade(
  upgrade: ShopUpgradeData,
  player: PlayerStats,
  ownedLures: Set<string>,
  levels: Record<string, number>,
): void {
  levels[upgrade.id] = (levels[upgrade.id] ?? 0) + 1;

  switch (upgrade.stat) {
    case StatName.LURE:
      ownedLures.add(upgrade.id);
      break;
    case StatName.ATTACK:
      player.attack += upgrade.valuePerLevel;
      break;
    case StatName.DEFENSE:
      player.defense += upgrade.valuePerLevel;
      break;
    case StatName.HP:
      player.lineHP += upgrade.valuePerLevel;
      break;
    case StatName.INVENTORY:
      player.inventorySize += upgrade.valuePerLevel;
      break;
    case StatName.CAST_DISTANCE:
      player.castMax += upgrade.valuePerLevel;
      break;
  }
}

export function computeLureStats(
  fishData: FishData[],
  locationData: LocationFishEntry[],
  player: PlayerStats,
  trialsPerFish: number,
  lureLevels: Record<string, number> = {},
): {
  rates: Record<string, number>;
  earnings: Record<string, number>;
  winRates: Record<string, number>;
  remainingHPs: Record<string, number>;
} {
  const fishByLure = new Map<string, FishData[]>();
  for (const fish of fishData) {
    if (!fishByLure.has(fish.requiredLure))
      fishByLure.set(fish.requiredLure, []);
    fishByLure.get(fish.requiredLure)!.push(fish);
  }
  const fishWeights = buildFishWeights(fishByLure, locationData);
  const rates: Record<string, number> = {};
  const earnings: Record<string, number> = {};
  const winRates: Record<string, number> = {};
  const remainingHPs: Record<string, number> = {};

  for (const [lureId, pool] of fishByLure) {
    const priceMultiplier = lurePriceMultiplier(lureLevels[lureId] ?? 0);
    let totalEarnings = 0;
    let totalFightTime = 0;
    let totalWinRate = 0;
    let totalRemainingHP = 0;
    let totalWinWeight = 0;
    for (const fish of pool) {
      const { winCount, avgFightTime, avgWinTension } = runTrials(
        fish,
        player,
        trialsPerFish,
      );
      const weight = fishWeights.get(fish.id) ?? 1 / pool.length;
      const avgEarnings = (fish.basePrice * priceMultiplier * winCount) / trialsPerFish;
      totalEarnings += avgEarnings * weight;
      totalFightTime += avgFightTime * weight;
      totalWinRate += (winCount / trialsPerFish) * weight;
      if (winCount > 0) {
        totalRemainingHP +=
          ((player.lineHP - avgWinTension) / player.lineHP) * 100 * weight;
        totalWinWeight += weight;
      }
    }
    // totalFightTime is already a weighted average (weights sum to 1)
    if (totalFightTime === 0) continue;
    rates[lureId] = totalEarnings / totalFightTime;
    earnings[lureId] = totalEarnings;
    winRates[lureId] = totalWinRate;
    if (totalWinWeight > 0)
      remainingHPs[lureId] = totalRemainingHP / totalWinWeight;
  }

  return { rates, earnings, winRates, remainingHPs };
}

export function simulateEconomy(
  fishData: FishData[],
  shopData: ShopUpgradeData[],
  locationData: LocationFishEntry[],
  start: PlayerStats = {
    ...INITIAL_PLAYER_STATE,
  },
  maxMinutes = 60,
  evalTrials = EVAL_TRIALS,
  strategy: UpgradeStrategy = DEFAULT_UPGRADE_STRATEGY,
): EconomyRound[] {
  const maxTime = maxMinutes * 60;
  const player = { ...start };
  const levels: Record<string, number> = Object.fromEntries(
    shopData.map((u) => [u.id, 0]),
  );
  let wallet = 0;
  let cumulativeTime = 0;
  const rounds: EconomyRound[] = [];
  const lureXpMap: Record<string, number> = {};
  const fishByLure = new Map<string, FishData[]>();
  for (const fish of fishData) {
    if (!fishByLure.has(fish.requiredLure))
      fishByLure.set(fish.requiredLure, []);
    fishByLure.get(fish.requiredLure)!.push(fish);
  }
  const shopLureIds = new Set(
    shopData.filter((u) => u.stat === StatName.LURE).map((u) => u.id),
  );
  const ownedLures = new Set<string>(
    [...fishByLure.keys()].filter((id) => id && !shopLureIds.has(id)),
  );
  const fishWeights = buildFishWeights(fishByLure, locationData);

  for (let round = 1; round <= MAX_ROUNDS; round++) {
    const {
      best,
      catchTimes: fishCatchTimes,
      earnings: fishEarnings,
      lureRates,
      lureWinRates,
      lureRemainingHP,
    } = evalLure(fishByLure, player, ownedLures, fishWeights, evalTrials, lureXpMap);
    if (!best) break;

    const { lureId, avgFightTime, avgEarningsPerCast } = best;
    const overhead = perCastOverhead(player.castMax, lureId, fishByLure);
    const roundTime = player.inventorySize * (overhead + avgFightTime);
    const income = player.inventorySize * avgEarningsPerCast;
    wallet += income;
    cumulativeTime += roundTime;

    if (lureId) {
      const pool = fishByLure.get(lureId) ?? [];
      const validZones = [...new Set(pool.flatMap((f) => f.zones))];
      const maxZoneDist =
        validZones.length > 0
          ? Math.max(...validZones.map((z) => ZONE_RANGES[z][1]))
          : player.castMax;
      const effectiveCast = Math.min(player.castMax, maxZoneDist);
      const avgLuringDist =
        expectedLuringTime(effectiveCast) * LURING_REEL_MAX_SPEED;
      const winRate = lureWinRates[lureId] ?? 0;
      const xpPerRound =
        player.inventorySize *
        (avgLuringDist * XP_PER_DISTANCE +
          winRate * XP_WIN +
          (1 - winRate) * XP_LOSS);
      lureXpMap[lureId] = (lureXpMap[lureId] ?? 0) + xpPerRound;
    }

    const walletSnapshot = wallet;
    const upgradesBought: string[] = [];
    let boughtLure = false;

    const pickUpgrade = (w: number) => {
      if (strategy.type === "PRIORITIZE_LURE") {
        return prioritizeLureUpgrade(
          shopData,
          levels,
          w,
          player,
          income,
          strategy.lureRoundTrips,
        );
      }
      return cheapestUpgrade(shopData, levels, w, player);
    };

    let nextUpgrade = pickUpgrade(wallet);
    while (nextUpgrade !== null) {
      const { upgrade, price } = nextUpgrade;
      wallet -= price;
      applyUpgrade(upgrade, player, ownedLures, levels);
      upgradesBought.push(`${upgrade.id} L${levels[upgrade.id]}`);
      if (upgrade.stat === StatName.LURE) boughtLure = true;
      nextUpgrade = pickUpgrade(wallet);
    }

    const lureLevels: Record<string, number> = {};
    for (const [id, xp] of Object.entries(lureXpMap)) {
      lureLevels[id] = computeLureLevel(xp);
    }

    rounds.push({
      round,
      cumulativeTime,
      roundTime,
      fightDuration: avgFightTime,
      income,
      wallet: walletSnapshot,
      rate: income / roundTime,
      lureId,
      fishCatchTimes,
      fishEarnings,
      lureRates,
      lureWinRates,
      lureRemainingHP,
      upgradesBought,
      upgradeLevels: { ...levels },
      boughtLure,
      playerStats: { ...player },
      lureLevels,
      lureXp: { ...lureXpMap },
    });

    if (cumulativeTime >= maxTime) break;

    const allMaxed = shopData.every(
      (u) => (levels[u.id] ?? 0) >= u.prices.length,
    );
    if (allMaxed) break;
  }

  return rounds;
}
