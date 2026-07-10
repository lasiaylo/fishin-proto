import { FightEngine, Outcome } from "./FightEngine";
import {
  BaitData,
  FishData,
  LocationFishEntry,
  RodData,
  ShopUpgradeData,
  StatName,
  levelStat,
} from "../util/csvLoader";
import { avgZoneDistance } from "../util/zones";
import { lerp } from "../util/easing";
import {
  applyLureXp,
  BAIT_MAX_STACK,
  CAST_CHARGE_DURATION,
  CAST_DURATION_MAX,
  CAST_DURATION_MIN,
  CAST_MAX,
  CAST_MIN,
  computeDreamPoints,
  computeLureLevel,
  DAY_DURATION_MS,
  getTackleType,
  INITIAL_PLAYER_STATE,
  LURE_BITE_CHANCE_PER_LEVEL,
  lureReelMaxSpeed,
  TackleType,
  LURING_REEL_MAX_SPEED,
  Rarity,
  RARITY_PRICE_MULTIPLIER,
  RARITY_STAT_MULTIPLIER,
  RARITY_WEIGHTS,
  RESULT_DURATION,
  TARGET_BITE_CHANCE,
  WAIT_PRIME_MAX,
  WAIT_PRIME_MIN,
  WAIT_PRIME_REDUCTION,
  WAIT_ZONE_RANGES,
  XP_PER_DISTANCE,
  XP_WIN,
  Zone,
  ZONE_RANGES,
  BASE_FISH_ID,
} from "../util/constants";
import { PlayerStats } from "../stores/playerStore";

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
  income: number; // gross fish earnings (revenue)
  netIncome: number; // income minus amortized bait cost
  wallet: number; // after income, before upgrades
  rate: number; // net $/sec (netIncome / roundTime)
  lureId: string; // "" = no lure
  baitId: string; // "" = no bait rod active; otherwise the tackle used by secondary rods
  rodCount: number;
  fishCatchTimes: Record<string, number>; // fishId → avgFightTime (all fish in chosen lure pool)
  fishEarnings: Record<string, number>; // fishId → avgEarnings considering win rate
  lureRates: Record<string, number>; // lureId → $/s for each accessible lure
  lureWinRates: Record<string, number>; // lureId → win % (0–1)
  lureRemainingHP: Record<string, number>; // lureId → avg remaining line HP on wins
  upgradesBought: string[];
  upgradeLevels: Record<string, number>;
  boughtLure: boolean;
  playerStats: PlayerStats;
  rodStats: { id: string; attack: number; defense: number; castMax: number }[]; // snapshot of rods
  lureLevels: Record<string, number>; // lureId → current level after this round
  lureXp: Record<string, number>; // lureId → cumulative XP after this round
  dayNumber: number;
  cumulativeMoneyEarned: number; // lifetime gross income, never reset — drives dream points
  moneyEarnedToday: number; // gross income since the last simulated day boundary
  dreamPoints: number; // spendable dream point balance
  dreamUpgradesBought: string[];
}

// ── Helpers ──

const trialsCache = new Map<
  string,
  { winCount: number; avgFightTime: number; avgWinTension: number }
>();

function expandFishByRarity(
  fish: FishData,
): Array<{ fish: FishData; weight: number }> {
  const rarities =
    fish.id === BASE_FISH_ID
      ? [Rarity.COMMON]
      : (Object.values(Rarity) as Rarity[]);
  const totalWeight = rarities.reduce((s, r) => s + RARITY_WEIGHTS[r], 0);
  return rarities.map((rarity) => ({
    fish: {
      ...fish,
      attack: fish.attack * RARITY_STAT_MULTIPLIER[rarity],
      defense: fish.defense * RARITY_STAT_MULTIPLIER[rarity],
      thrash: fish.thrash * RARITY_STAT_MULTIPLIER[rarity],
      hp: fish.hp * RARITY_STAT_MULTIPLIER[rarity],
      basePrice: fish.basePrice * RARITY_PRICE_MULTIPLIER[rarity],
    },
    weight: RARITY_WEIGHTS[rarity] / totalWeight,
  }));
}

function runTrials(
  fish: FishData,
  player: PlayerStats,
  atk: number,
  def: number,
  n: number,
): { winCount: number; avgFightTime: number; avgWinTension: number } {
  const zoneDist = avgZoneDistance(fish.zones);
  const key = `${fish.attack}|${fish.defense}|${fish.thrash}|${fish.hp}|${zoneDist}|${atk}|${def}|${player.lineHP}|${n}`;
  const cached = trialsCache.get(key);
  if (cached) return cached;

  const engine = new FightEngine(
    fish.attack,
    fish.defense,
    fish.thrash,
    atk,
    def,
    player.lineHP,
    zoneDist,
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

  const result = {
    winCount,
    avgFightTime: totalWinTime / n,
    avgWinTension: winCount > 0 ? totalWinTension / winCount : 0,
  };
  trialsCache.set(key, result);
  return result;
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
  rods: EconRod[],
  rodData: RodData[],
  player: PlayerStats,
  ownedLures: Set<string>,
  fishWeights: Map<string, number>,
  evalTrials: number,
  lureXpMap: Record<string, number> = {},
  baitCostPerFight: Record<string, number> = {},
): {
  best: {
    lureId: string;
    avgFightTime: number;
    avgEarningsPerFight: number;
  } | null;
  bestBaitId: string | null;
  catchTimes: Record<string, number>;
  earnings: Record<string, number>;
  lureRates: Record<string, number>;
  lureWinRates: Record<string, number>;
  lureRemainingHP: Record<string, number>;
} {
  const { attack: lureRodAtk, defense: lureRodDef } = econRodStats(
    rods[0],
    rodData,
  );
  const incomeMultiplier = 1 + player.incomeBoostPercent / 100;
  let bestRate;
  let best = null;
  let bestBaitRate: number | undefined;
  let bestBaitId: string | null = null;
  const catchTimes: Record<string, number> = {};
  const earnings: Record<string, number> = {};
  const lureRates: Record<string, number> = {};
  const lureWinRates: Record<string, number> = {};
  const lureRemainingHP: Record<string, number> = {};

  for (const [lureId, pool] of groups) {
    if (lureId && !ownedLures.has(lureId)) continue;

    let totalEarnings = 0;
    let totalFightTime = 0;
    let totalWinRate = 0;
    let totalRemainingHP = 0;

    for (const fish of pool) {
      const fishWeight = fishWeights.get(fish.id) ?? 1 / pool.length;
      let fishTotalTime = 0;
      let fishTotalEarnings = 0;
      for (const { fish: variant, weight: rarityWeight } of expandFishByRarity(
        fish,
      )) {
        const combinedWeight = fishWeight * rarityWeight;
        const { winCount, avgFightTime, avgWinTension } = runTrials(
          variant,
          player,
          lureRodAtk,
          lureRodDef,
          evalTrials,
        );
        const avgEarnings =
          (variant.basePrice * incomeMultiplier * winCount) / evalTrials;
        fishTotalTime += avgFightTime * rarityWeight;
        fishTotalEarnings += avgEarnings * rarityWeight;
        totalEarnings += avgEarnings * combinedWeight;
        totalFightTime += avgFightTime * combinedWeight;
        totalWinRate += (winCount / evalTrials) * combinedWeight;
        totalRemainingHP +=
          ((player.lineHP - avgWinTension) / player.lineHP) *
          100 *
          combinedWeight;
      }
      catchTimes[fish.id] = fishTotalTime;
      earnings[fish.id] =
        fishTotalTime > 0 ? fishTotalEarnings / fishTotalTime : 0;
    }

    // totalFightTime and totalEarnings are already weighted averages (weights sum to 1)
    if (totalFightTime === 0) continue;

    const avgFightTime = totalFightTime;
    const avgEarningsPerFight = totalEarnings;
    const costPerFight =
      getTackleType(lureId) === TackleType.BAIT
        ? (baitCostPerFight[lureId] ?? 0)
        : 0;
    const rate = (avgEarningsPerFight - costPerFight) / avgFightTime;
    lureRates[lureId] = rate;
    lureWinRates[lureId] = totalWinRate;
    lureRemainingHP[lureId] = totalRemainingHP;

    if (bestRate === undefined || rate >= bestRate) {
      bestRate = rate;
      best = { lureId, avgFightTime, avgEarningsPerFight };
    }

    if (getTackleType(lureId) === TackleType.BAIT) {
      if (bestBaitRate === undefined || rate >= bestBaitRate) {
        bestBaitRate = rate;
        bestBaitId = lureId;
      }
    }
  }

  return {
    best,
    bestBaitId: bestBaitId,
    catchTimes,
    earnings,
    lureRates,
    lureWinRates,
    lureRemainingHP,
  };
}

function expectedWaitTime(bait?: BaitData): number {
  if (bait) {
    return ((bait.waitMin + bait.waitMax) / 2) * (1 - WAIT_PRIME_REDUCTION);
  }
  return ((WAIT_PRIME_MIN + WAIT_PRIME_MAX) / 2) * (1 - WAIT_PRIME_REDUCTION);
}

function perCastOverhead(
  castMax: number,
  lureId: string,
  fishByLure: Map<string, FishData[]>,
  lureLevel = 0,
  baitDataMap: Map<string, BaitData> = new Map(),
): number {
  const isBait = getTackleType(lureId) === TackleType.BAIT;
  const pool = fishByLure.get(lureId) ?? [];
  const zoneRanges = isBait ? WAIT_ZONE_RANGES : ZONE_RANGES;
  const validZones = [...new Set(pool.flatMap((f) => f.zones))];
  const maxZoneDist = Math.max(...validZones.map((z) => zoneRanges[z][1]));
  const effectiveCast = Math.min(castMax, maxZoneDist);
  const castT =
    castMax > CAST_MIN ? (effectiveCast - CAST_MIN) / (castMax - CAST_MIN) : 0;
  const chargeTime = lerp(0, CAST_CHARGE_DURATION / 1000, castT);
  const castAnimDuration = lerp(CAST_DURATION_MIN, CAST_DURATION_MAX, castT);
  const luringTime = isBait
    ? expectedWaitTime(baitDataMap.get(lureId))
    : expectedLuringTime(effectiveCast, lureReelMaxSpeed(lureLevel), lureLevel);
  return chargeTime + castAnimDuration + luringTime + RESULT_DURATION / 1000;
}

function expectedLuringTime(
  effectiveCast: number,
  reelMaxSpeed = LURING_REEL_MAX_SPEED,
  lureLevel = 0,
): number {
  const biteChance =
    TARGET_BITE_CHANCE + lureLevel * LURE_BITE_CHANCE_PER_LEVEL;
  const zoneOrder = [Zone.FAR, Zone.MID, Zone.CLOSE];
  let survivalProb = 1;
  let expectedDistance = 0;
  for (const zone of zoneOrder) {
    const [zMin, zMax] = ZONE_RANGES[zone];
    if (effectiveCast < zMin) continue;
    const entryDistance = Math.min(effectiveCast, zMax);
    const reelDistance = entryDistance - zMin;
    expectedDistance += survivalProb * biteChance * reelDistance;
    survivalProb *= 1 - biteChance;
  }

  // Chance of going through without any hooks
  expectedDistance += survivalProb * effectiveCast;
  return expectedDistance / reelMaxSpeed;
}

// Probability of getting at least one bite on a single full cast.
function castBiteProbability(effectiveCast: number, lureLevel = 0): number {
  const biteChance =
    TARGET_BITE_CHANCE + lureLevel * LURE_BITE_CHANCE_PER_LEVEL;
  const zoneOrder = [Zone.FAR, Zone.MID, Zone.CLOSE];
  let survivalProb = 1;
  for (const zone of zoneOrder) {
    const [zMin] = ZONE_RANGES[zone];
    if (effectiveCast < zMin) continue;
    survivalProb *= 1 - biteChance;
  }
  return 1 - survivalProb;
}

function cheapestUpgrade(
  shopData: ShopUpgradeData[],
  levels: Record<string, number>,
  currency: number,
  player: PlayerStats,
  rods: EconRod[],
  baitStock: Record<string, number>,
): { upgrade: ShopUpgradeData; price: number } | null {
  const statValue = (stat: StatName): number => {
    switch (stat) {
      case StatName.HP:
        return player.lineHP;
      case StatName.INVENTORY:
        return player.inventorySize;
      case StatName.INCOME:
        return player.incomeBoostPercent;
      case StatName.LURE:
        return 0;
      case StatName.ROD:
      case StatName.ROD_SLOT:
      case StatName.ROD_ATTACK:
      case StatName.ROD_DEFENSE:
      case StatName.BAIT:
        return 0;
      default:
        return Infinity;
    }
  };

  let best: { upgrade: ShopUpgradeData; price: number } | null = null;

  for (const upgrade of shopData) {
    const level = levels[upgrade.id] ?? 0;
    if (level >= upgrade.prices.length) continue;
    const price = upgrade.prices[level];
    if (price > currency) continue;
    if (upgrade.stat === StatName.BAIT) {
      if ((baitStock[upgrade.id] ?? 0) < BAIT_MAX_STACK)
        return { upgrade, price };
      continue;
    }
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
  rods: EconRod[],
  income: number,
  roundTripsThreshold: number,
  baitStock: Record<string, number>,
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

  return cheapestUpgrade(shopData, levels, wallet, player, rods, baitStock);
}

interface EconRod {
  id: string;
  attackLevel: number;
  defenseLevel: number;
}

function econRodStats(
  rod: EconRod,
  rodData: RodData[],
): { attack: number; defense: number; castMax: number } {
  const data = rodData.find((r) => r.id === rod.id);
  return {
    attack: levelStat(data?.attackLevels ?? [], rod.attackLevel),
    defense: levelStat(data?.defenseLevels ?? [], rod.defenseLevel),
    castMax: data?.castMax ?? CAST_MAX,
  };
}

function applyUpgrade(
  upgrade: ShopUpgradeData,
  player: PlayerStats,
  ownedLures: Set<string>,
  levels: Record<string, number>,
  rods: EconRod[],
  rodCountRef: { value: number },
  baitStock: Record<string, number>,
  benchedRods: EconRod[],
  openSlotsRef: { value: number },
): void {
  if (upgrade.stat !== StatName.BAIT) {
    levels[upgrade.id] = (levels[upgrade.id] ?? 0) + 1;
  }

  switch (upgrade.stat) {
    case StatName.LURE:
      ownedLures.add(upgrade.id);
      break;
    case StatName.HP:
      player.lineHP += upgrade.valuePerLevel;
      break;
    case StatName.INVENTORY:
      player.inventorySize += upgrade.valuePerLevel;
      break;
    case StatName.INCOME:
      player.incomeBoostPercent += upgrade.valuePerLevel;
      break;
    case StatName.BAIT:
      baitStock[upgrade.id] =
        (baitStock[upgrade.id] ?? 0) + upgrade.valuePerLevel;
      break;
    case StatName.ROD: {
      const newRod = { id: upgrade.id, attackLevel: 0, defenseLevel: 0 };
      if (openSlotsRef.value > 0) {
        openSlotsRef.value--;
        rodCountRef.value++;
        rods.push(newRod);
      } else {
        benchedRods.push(newRod);
      }
      break;
    }
    case StatName.ROD_SLOT: {
      const benched = benchedRods.shift();
      if (benched) {
        rodCountRef.value++;
        rods.push(benched);
      } else {
        openSlotsRef.value++;
      }
      break;
    }
    case StatName.ROD_ATTACK: {
      const rodId = upgrade.id.replace("_ATTACK", "");
      const rod =
        rods.find((r) => r.id === rodId) ??
        benchedRods.find((r) => r.id === rodId);
      if (rod) rod.attackLevel += 1;
      break;
    }
    case StatName.ROD_DEFENSE: {
      const rodId = upgrade.id.replace("_DEFENSE", "");
      const rod =
        rods.find((r) => r.id === rodId) ??
        benchedRods.find((r) => r.id === rodId);
      if (rod) rod.defenseLevel += 1;
      break;
    }
  }
}

export function computeLureStats(
  fishData: FishData[],
  locationData: LocationFishEntry[],
  player: PlayerStats,
  atk: number,
  def: number,
  trialsPerFish: number,
): {
  rates: Record<string, number>;
  earnings: Record<string, number>;
  winRates: Record<string, number>;
  remainingHPs: Record<string, number>;
} {
  const fishByLure = new Map<string, FishData[]>();
  for (const fish of fishData) {
    if (!fishByLure.has(fish.requiredTackle))
      fishByLure.set(fish.requiredTackle, []);
    fishByLure.get(fish.requiredTackle)!.push(fish);
  }
  const fishWeights = buildFishWeights(fishByLure, locationData);
  const incomeMultiplier = 1 + player.incomeBoostPercent / 100;
  const rates: Record<string, number> = {};
  const earnings: Record<string, number> = {};
  const winRates: Record<string, number> = {};
  const remainingHPs: Record<string, number> = {};

  for (const [lureId, pool] of fishByLure) {
    let totalEarnings = 0;
    let totalFightTime = 0;
    let totalWinRate = 0;
    let totalRemainingHP = 0;
    let totalWinWeight = 0;
    for (const fish of pool) {
      const fishWeight = fishWeights.get(fish.id) ?? 1 / pool.length;
      for (const { fish: variant, weight: rarityWeight } of expandFishByRarity(
        fish,
      )) {
        const combinedWeight = fishWeight * rarityWeight;
        const { winCount, avgFightTime, avgWinTension } = runTrials(
          variant,
          player,
          atk,
          def,
          trialsPerFish,
        );
        const avgEarnings =
          (variant.basePrice * incomeMultiplier * winCount) / trialsPerFish;
        totalEarnings += avgEarnings * combinedWeight;
        totalFightTime += avgFightTime * combinedWeight;
        totalWinRate += (winCount / trialsPerFish) * combinedWeight;
        if (winCount > 0) {
          totalRemainingHP +=
            ((player.lineHP - avgWinTension) / player.lineHP) *
            100 *
            combinedWeight;
          totalWinWeight += combinedWeight;
        }
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
  start: PlayerStats = { ...INITIAL_PLAYER_STATE },
  maxMinutes = 60,
  evalTrials = EVAL_TRIALS,
  strategy: UpgradeStrategy = DEFAULT_UPGRADE_STRATEGY,
  baitData: BaitData[] = [],
  rodData: RodData[] = [],
  dreamShopData: ShopUpgradeData[] = [],
): EconomyRound[] {
  const maxTime = maxMinutes * 60;
  const player = { ...start };
  const levels: Record<string, number> = Object.fromEntries(
    shopData.map((u) => [u.id, 0]),
  );
  const dreamLevels: Record<string, number> = Object.fromEntries(
    dreamShopData.map((u) => [u.id, 0]),
  );
  let wallet = 0;
  let cumulativeTime = 0;
  const DAY_DURATION_S = DAY_DURATION_MS / 1000;
  let dayNumber = 1;
  let dayElapsed = 0;
  let cumulativeMoneyEarned = 0;
  let moneyEarnedToday = 0;
  let dreamPoints = 0;
  const rounds: EconomyRound[] = [];
  const lureXpMap: Record<string, number> = {};
  const fishByTackle = new Map<string, FishData[]>();
  for (const fish of fishData) {
    if (!fishByTackle.has(fish.requiredTackle))
      fishByTackle.set(fish.requiredTackle, []);
    fishByTackle.get(fish.requiredTackle)!.push(fish);
  }
  const shopLureIds = new Set(
    shopData.filter((u) => u.stat === StatName.LURE).map((u) => u.id),
  );
  const shopBaitIds = new Set(
    shopData.filter((u) => u.stat === StatName.BAIT).map((u) => u.id),
  );
  const ownedLures = new Set<string>(
    [...fishByTackle.keys()].filter((id) => {
      if (!id || shopLureIds.has(id)) return false;
      if (getTackleType(id) === TackleType.BAIT) return shopBaitIds.has(id);
      return true;
    }),
  );
  const baitStock: Record<string, number> = {};
  for (const lureId of ownedLures) {
    if (getTackleType(lureId) === TackleType.BAIT) {
      baitStock[lureId] = BAIT_MAX_STACK;
    }
  }
  const baitCostPerFight: Record<string, number> = {};
  for (const upgrade of shopData) {
    if (
      upgrade.stat === StatName.BAIT &&
      upgrade.prices.length > 0 &&
      upgrade.valuePerLevel > 0
    ) {
      baitCostPerFight[upgrade.id] = upgrade.prices[0] / upgrade.valuePerLevel;
    }
  }
  const fishWeights = buildFishWeights(fishByTackle, locationData);
  const baitDataMap = new Map(baitData.map((b) => [b.id, b]));
  const initialRod = INITIAL_PLAYER_STATE.ownedRods[0];
  const rods: EconRod[] = [
    {
      id: initialRod.id,
      attackLevel: initialRod.attackLevel,
      defenseLevel: initialRod.defenseLevel,
    },
  ];
  const rodCountRef = { value: 1 };
  const benchedRods: EconRod[] = [];
  const openSlotsRef = { value: 0 };

  for (let round = 1; round <= MAX_ROUNDS; round++) {
    const {
      best,
      bestBaitId,
      catchTimes: fishCatchTimes,
      earnings: fishEarnings,
      lureRates,
      lureWinRates,
      lureRemainingHP,
    } = evalLure(
      fishByTackle,
      rods,
      rodData,
      player,
      ownedLures,
      fishWeights,
      evalTrials,
      lureXpMap,
      baitCostPerFight,
    );
    if (!best) break;

    const { lureId, avgFightTime, avgEarningsPerFight } = best;
    const lureLevel = computeLureLevel(lureXpMap[lureId] ?? 0);
    const lureRodStats = econRodStats(rods[0], rodData);
    const overhead = perCastOverhead(
      lureRodStats.castMax,
      lureId,
      fishByTackle,
      lureLevel,
      baitDataMap,
    );
    if (!(lureId in lureWinRates))
      throw new Error(`No win rate for lureId "${lureId}"`);
    const winRate = Math.max(lureWinRates[lureId], 0.001);

    // pBite: probability of getting a fight on a single cast
    const isBait = getTackleType(lureId) === TackleType.BAIT;
    const pool = fishByTackle.get(lureId) ?? [];
    const zoneRanges = isBait ? WAIT_ZONE_RANGES : ZONE_RANGES;
    const validZones = [...new Set(pool.flatMap((f) => f.zones))];
    const maxZoneDist =
      validZones.length > 0
        ? Math.max(...validZones.map((z) => zoneRanges[z][1]))
        : lureRodStats.castMax;
    const effectiveCast = Math.min(lureRodStats.castMax, maxZoneDist);
    const pBite = isBait
      ? 1
      : Math.max(castBiteProbability(effectiveCast, lureLevel), 0.001);

    // Lure rod fills the entire inventory. Round time is based on the lure rod alone.
    const catchTime = (1 / winRate) * (overhead / pBite + avgFightTime);
    const roundTime = player.inventorySize * catchTime;
    const lureIncome = player.inventorySize * (avgEarningsPerFight / winRate);

    const lureFightsPerRound = player.inventorySize / winRate;
    if (isBait) {
      baitStock[lureId] = (baitStock[lureId] ?? 0) - lureFightsPerRound;
    }

    // Bait rods (rods[1+]) earn additional income in parallel during roundTime.
    // Each bait rod uses the best BAIT lure and its own atk/def for fights.
    let baitRodIncome = 0;
    let baitRodBaitCost = 0;
    const baitRods = rods.slice(1);
    const incomeMultiplier = 1 + player.incomeBoostPercent / 100;
    if (baitRods.length > 0 && bestBaitId !== null) {
      const baitPool = fishByTackle.get(bestBaitId) ?? [];

      for (const baitRod of baitRods) {
        const baitRodStats = econRodStats(baitRod, rodData);
        const baitOverhead = perCastOverhead(
          baitRodStats.castMax,
          bestBaitId,
          fishByTackle,
          0,
          baitDataMap,
        );
        let baitTotalEarnings = 0;
        let baitTotalFightTime = 0;
        let baitTotalWinRate = 0;

        for (const fish of baitPool) {
          const fishWeight = fishWeights.get(fish.id) ?? 1 / baitPool.length;
          for (const {
            fish: variant,
            weight: rarityWeight,
          } of expandFishByRarity(fish)) {
            const combinedWeight = fishWeight * rarityWeight;
            const { winCount, avgFightTime: baitFightTime } = runTrials(
              variant,
              player,
              baitRodStats.attack,
              baitRodStats.defense,
              evalTrials,
            );
            const avgEarnings =
              (variant.basePrice * incomeMultiplier * winCount) / evalTrials;
            baitTotalEarnings += avgEarnings * combinedWeight;
            baitTotalFightTime += baitFightTime * combinedWeight;
            baitTotalWinRate += (winCount / evalTrials) * combinedWeight;
          }
        }

        if (baitTotalFightTime > 0 && baitTotalWinRate > 0) {
          // BAIT: pBite=1
          const baitCatchTime =
            (1 / baitTotalWinRate) * (baitOverhead + baitTotalFightTime);
          const baitRate = baitTotalEarnings / baitCatchTime;
          baitRodIncome += roundTime * baitRate;
          const baitRodFights = roundTime / baitCatchTime;
          baitStock[bestBaitId!] =
            (baitStock[bestBaitId!] ?? 0) - baitRodFights;
          baitRodBaitCost +=
            baitRodFights * (baitCostPerFight[bestBaitId!] ?? 0);
        }
      }
    }

    const income = lureIncome + baitRodIncome;
    const lureBaitCost = isBait
      ? lureFightsPerRound * (baitCostPerFight[lureId] ?? 0)
      : 0;
    const netIncome = income - lureBaitCost - baitRodBaitCost;

    wallet += income;
    cumulativeTime += roundTime;

    const prevCumulativeMoneyEarned = cumulativeMoneyEarned;
    cumulativeMoneyEarned += income;
    moneyEarnedToday += income;
    dreamPoints +=
      computeDreamPoints(cumulativeMoneyEarned) -
      computeDreamPoints(prevCumulativeMoneyEarned);

    // Simulated day boundary: reset the daily counter and let dream upgrades
    // be "purchased" the same way the End of Day popup does, mirroring dayStore.
    dayElapsed += roundTime;
    const dreamUpgradesBought: string[] = [];
    while (dayElapsed >= DAY_DURATION_S) {
      dayElapsed -= DAY_DURATION_S;
      dayNumber += 1;
      moneyEarnedToday = 0;

      let nextDreamUpgrade = cheapestUpgrade(
        dreamShopData,
        dreamLevels,
        dreamPoints,
        player,
        rods,
        baitStock,
      );
      while (nextDreamUpgrade !== null) {
        const { upgrade, price } = nextDreamUpgrade;
        dreamPoints -= price;
        applyUpgrade(
          upgrade,
          player,
          ownedLures,
          dreamLevels,
          rods,
          rodCountRef,
          baitStock,
          benchedRods,
          openSlotsRef,
        );
        dreamUpgradesBought.push(
          `${upgrade.id} L${dreamLevels[upgrade.id] ?? 1}`,
        );
        nextDreamUpgrade = cheapestUpgrade(
          dreamShopData,
          dreamLevels,
          dreamPoints,
          player,
          rods,
          baitStock,
        );
      }
    }

    if (lureId) {
      const castsPerRound = player.inventorySize / (pBite * winRate);
      let xpPerRound: number;
      if (isBait) {
        xpPerRound = castsPerRound * winRate * XP_WIN;
      } else {
        const reelMaxSpeed = lureReelMaxSpeed(lureLevel);
        const avgLuringDist =
          expectedLuringTime(effectiveCast, reelMaxSpeed, lureLevel) *
          reelMaxSpeed;
        xpPerRound =
          castsPerRound *
          (avgLuringDist * XP_PER_DISTANCE + pBite * winRate * XP_WIN);
      }
      lureXpMap[lureId] = applyLureXp(lureXpMap[lureId] ?? 0, xpPerRound).xp;
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
          rods,
          income,
          strategy.lureRoundTrips,
          baitStock,
        );
      }
      return cheapestUpgrade(shopData, levels, w, player, rods, baitStock);
    };

    let nextUpgrade = pickUpgrade(wallet);
    while (nextUpgrade !== null) {
      const { upgrade, price } = nextUpgrade;
      wallet -= price;
      applyUpgrade(
        upgrade,
        player,
        ownedLures,
        levels,
        rods,
        rodCountRef,
        baitStock,
        benchedRods,
        openSlotsRef,
      );
      upgradesBought.push(`${upgrade.id} L${levels[upgrade.id] ?? 1}`);
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
      netIncome,
      wallet: walletSnapshot,
      rate: netIncome / roundTime,
      lureId,
      baitId: isBait ? lureId : baitRods.length > 0 ? (bestBaitId ?? "") : "",
      rodCount: rods.length,
      fishCatchTimes,
      fishEarnings,
      lureRates,
      lureWinRates,
      lureRemainingHP,
      upgradesBought,
      upgradeLevels: { ...levels },
      boughtLure,
      playerStats: { ...player },
      rodStats: rods.map((r) => ({ id: r.id, ...econRodStats(r, rodData) })),
      lureLevels,
      lureXp: { ...lureXpMap },
      dayNumber,
      cumulativeMoneyEarned,
      moneyEarnedToday,
      dreamPoints,
      dreamUpgradesBought,
    });

    if (cumulativeTime >= maxTime) break;

    const allMaxed = shopData.every(
      (u) => (levels[u.id] ?? 0) >= u.prices.length,
    );
    if (allMaxed) break;
  }

  return rounds;
}
