import { FightEngine, MAX_SIM_TIME, Outcome } from "./FightEngine";
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
  fishId: string;
  fishCatchTimes: Record<string, number>; // fishId → CAST_WAIT_TIME + avgFightTime (accessible fish only)
  upgradesBought: string[];
  upgradeLevels: Record<string, number>;
  boughtLure: boolean;
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

function evalFish(
  fishData: FishData[],
  player: PlayerStats,
  ownedLures: Set<string>,
): {
  best: { fish: FishData; avgFightTime: number } | null;
  catchTimes: Record<string, number>;
} {
  let bestRate;

  let best: { fish: FishData; avgFightTime: number } | null = null;
  const catchTimes: Record<string, number> = {};
  console.log("FISH", fishData);

  for (const fish of fishData) {
    if (fish.requiredLure && !ownedLures.has(fish.requiredLure)) continue;

    const { winCount, avgFightTime } = runTrials(fish, player, EVAL_TRIALS);
    if (winCount === 0 || avgFightTime > MAX_SIM_TIME) continue;

    catchTimes[fish.id] = avgFightTime;

    const rate = (fish.basePrice * winCount) / EVAL_TRIALS / avgFightTime;
    if (bestRate == undefined || rate >= bestRate) {
      bestRate = rate;
      best = { fish, avgFightTime };
    }
  }

  return { best, catchTimes };
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
      best = { upgrade, price };
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

  for (let round = 1; round <= MAX_ROUNDS; round++) {
    const { best, catchTimes: fishCatchTimes } = evalFish(
      fishData,
      player,
      ownedLures,
    );
    if (!best) break;

    const { fish, avgFightTime } = best;
    const roundTime =
      2 * SHOP_TRAVEL_TIME + FISH_PER_TRIP * (CAST_WAIT_TIME + avgFightTime);
    const income = FISH_PER_TRIP * fish.basePrice;
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
      fishId: fish.id,
      fishCatchTimes,
      upgradesBought,
      upgradeLevels: { ...levels },
      boughtLure,
    });

    const allMaxed = shopData.every(
      (u) => (levels[u.id] ?? 0) >= u.prices.length,
    );
    if (allMaxed) break;
  }

  return rounds;
}
