import { FightEngine, Outcome } from "./FightEngine";
import { FishData, ShopUpgradeData, StatName } from "../util/csvLoader";
import { INITIAL_PLAYER_STATE, PlayerStats } from "../stores/playerStore";

// ── Constants ──

const FISH_PER_TRIP = 4;
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
): { winCount: number; avgFightTime: number } {
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

  for (let i = 0; i < n; i++) {
    engine.reset();
    const { outcome, duration } = engine.runToCompletion();
    if (outcome === Outcome.WIN) {
      winCount++;
    }
    totalWinTime += duration;
  }

  return {
    winCount,
    avgFightTime: totalWinTime / n,
  };
}

function evalLure(
  groups: Map<string, FishData[]>,
  player: PlayerStats,
  ownedLures: Set<string>,
): {
  best: {
    lureId: string;
    avgFightTime: number;
    avgEarningsPerCast: number;
  } | null;
  catchTimes: Record<string, number>;
  earnings: Record<string, number>;
  lureRates: Record<string, number>;
} {
  let bestRate;
  let best = null;
  const catchTimes: Record<string, number> = {};
  const earnings: Record<string, number> = {};
  const lureRates: Record<string, number> = {};

  for (const [lureId, pool] of groups) {
    if (lureId && !ownedLures.has(lureId)) continue;

    let totalEarnings = 0;
    let totalFightTime = 0;

    for (const fish of pool) {
      const { winCount, avgFightTime } = runTrials(fish, player, EVAL_TRIALS);
      catchTimes[fish.id] = avgFightTime;
      const avgEarnings = (fish.basePrice * winCount) / EVAL_TRIALS;
      earnings[fish.id] = avgEarnings / avgFightTime;
      totalEarnings += avgEarnings;
      totalFightTime += avgFightTime;
    }

    const avgFightTime = totalFightTime / pool.length;
    if (avgFightTime === 0) continue;

    const avgEarningsPerCast = totalEarnings / pool.length;
    const rate = avgEarningsPerCast / avgFightTime;
    lureRates[lureId] = rate;

    if (bestRate === undefined || rate >= bestRate) {
      bestRate = rate;
      best = { lureId, avgFightTime, avgEarningsPerCast };
    }
  }

  return { best, catchTimes, earnings, lureRates };
}

function cheapestUpgrade(
  shopData: ShopUpgradeData[],
  levels: Record<string, number>,
  wallet: number,
): { upgrade: ShopUpgradeData; price: number } | null {
  let best: { upgrade: ShopUpgradeData; price: number } | null = null;

  for (const upgrade of shopData) {
    const level = levels[upgrade.id] ?? 0;
    if (level >= upgrade.prices.length) continue;
    const price = upgrade.prices[level];
    if (price > wallet) continue;
    if (upgrade.stat === StatName.LURE) {
      return { upgrade, price };
    }
    if (
      best === null ||
      (price < best.price && best.upgrade.stat !== StatName.LURE)
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
  }
}

// ── Main export ──

export function simulateEconomy(
  fishData: FishData[],
  shopData: ShopUpgradeData[],
  start: PlayerStats = {
    ...INITIAL_PLAYER_STATE,
  },
): EconomyRound[] {
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

  for (let round = 1; round <= MAX_ROUNDS; round++) {
    const {
      best,
      catchTimes: fishCatchTimes,
      earnings: fishEarnings,
      lureRates,
    } = evalLure(fishByLure, player, ownedLures);
    if (!best) break;

    const { lureId, avgFightTime, avgEarningsPerCast } = best;
    const roundTime = FISH_PER_TRIP * (CAST_WAIT_TIME + avgFightTime);
    const income = FISH_PER_TRIP * avgEarningsPerCast;
    wallet += income;
    cumulativeTime += roundTime;

    const walletSnapshot = wallet;
    const upgradesBought: string[] = [];
    let boughtLure = false;

    let cheapUpgrade = cheapestUpgrade(shopData, levels, wallet);
    while (cheapUpgrade !== null) {
      const { upgrade, price } = cheapUpgrade;
      wallet -= price;
      applyUpgrade(upgrade, player, ownedLures, levels);
      upgradesBought.push(`${upgrade.id} L${levels[upgrade.id]}`);
      if (upgrade.stat === StatName.LURE) boughtLure = true;
      cheapUpgrade = cheapestUpgrade(shopData, levels, wallet);
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
      upgradesBought,
      upgradeLevels: { ...levels },
      boughtLure,
      playerStats: { ...player },
    });

    const allMaxed = shopData.every(
      (u) => (levels[u.id] ?? 0) >= u.prices.length,
    );
    if (allMaxed) break;
  }

  return rounds;
}
