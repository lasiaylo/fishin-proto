import { FightEngine, Outcome } from "./FightEngine";
import {
  FishData,
  LocationFishEntry,
  ShopUpgradeData,
  StatName,
} from "../util/csvLoader";
import { INITIAL_PLAYER_STATE, PlayerStats } from "../stores/playerStore";

// ── Constants ──

const SHOP_TRAVEL_TIME = 5;
const CAST_WAIT_TIME = 5;
const EVAL_TRIALS = 100;
const MAX_ROUNDS = 100;

// ── Types ──

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
      const avgEarnings = (fish.basePrice * winCount) / evalTrials;
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
  }
}

export function computeLureStats(
  fishData: FishData[],
  locationData: LocationFishEntry[],
  player: PlayerStats,
  trialsPerFish: number,
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
      const avgEarnings = (fish.basePrice * winCount) / trialsPerFish;
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
): EconomyRound[] {
  const maxTime = maxMinutes * 60;
  const player = { ...start };
  const ownedLures = new Set<string>();
  const levels: Record<string, number> = Object.fromEntries(
    shopData.map((u) => [u.id, 0]),
  );
  let wallet = 0;
  let cumulativeTime = 0;
  const rounds: EconomyRound[] = [];
  const fishByLure = new Map<string, FishData[]>();
  for (const fish of fishData) {
    if (!fishByLure.has(fish.requiredLure))
      fishByLure.set(fish.requiredLure, []);
    fishByLure.get(fish.requiredLure)!.push(fish);
  }
  const fishWeights = buildFishWeights(fishByLure, locationData);

  for (let round = 1; round <= MAX_ROUNDS; round++) {
    const {
      best,
      catchTimes: fishCatchTimes,
      earnings: fishEarnings,
      lureRates,
      lureWinRates,
      lureRemainingHP,
    } = evalLure(fishByLure, player, ownedLures, fishWeights, evalTrials);
    if (!best) break;

    const { lureId, avgFightTime, avgEarningsPerCast } = best;
    const roundTime = player.inventorySize * (CAST_WAIT_TIME + avgFightTime);
    const income = player.inventorySize * avgEarningsPerCast;
    wallet += income;
    cumulativeTime += roundTime;

    const walletSnapshot = wallet;
    const upgradesBought: string[] = [];
    let boughtLure = false;

    let cheapUpgrade = cheapestUpgrade(shopData, levels, wallet, player);
    while (cheapUpgrade !== null) {
      const { upgrade, price } = cheapUpgrade;
      wallet -= price;
      applyUpgrade(upgrade, player, ownedLures, levels);
      upgradesBought.push(`${upgrade.id} L${levels[upgrade.id]}`);
      if (upgrade.stat === StatName.LURE) boughtLure = true;
      cheapUpgrade = cheapestUpgrade(shopData, levels, wallet, player);
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
    });

    if (cumulativeTime >= maxTime) break;

    const allMaxed = shopData.every(
      (u) => (levels[u.id] ?? 0) >= u.prices.length,
    );
    if (allMaxed) break;
  }

  return rounds;
}
