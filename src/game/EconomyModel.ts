import { FightEngine, Outcome, MAX_SIM_TIME } from "./FightEngine";
import { StatName } from "../util/csvLoader";
import type { FishData, ShopUpgradeData } from "../util/csvLoader";
import {
  INITIAL_PLAYER_STATE,
  PlayerState,
  PlayerStats,
} from "../stores/playerStore";

// ── Constants ──

const SHOP_TRAVEL_TIME = 5;
const CAST_WAIT_TIME = 5;
const EVAL_TRIALS = 500;
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
  upgradesBought: string[];
  upgradeLevels: Record<string, number>;
  boughtLure: boolean;
}

// ── Helpers ──

function runTrials(
  fish: FishData,
  player: PlayerStats,
  n: number,
): { winCount: number; avgWinTime: number } {
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
      totalWinTime += duration;
    }
  }

  return {
    winCount,
    avgWinTime: winCount > 0 ? totalWinTime / winCount : Infinity,
  };
}

function pickBestFish(
  fishData: FishData[],
  player: PlayerStats,
  ownedLures: Set<string>,
): { fish: FishData; avgFightTime: number } | null {
  const sorted = [...fishData].sort((a, b) => b.basePrice - a.basePrice);

  for (const fish of sorted) {
    if (fish.requiredLure && !ownedLures.has(fish.requiredLure)) continue;

    const { winCount, avgWinTime } = runTrials(fish, player, EVAL_TRIALS);
    if (winCount > 0 && avgWinTime <= MAX_SIM_TIME) {
      return { fish, avgFightTime: avgWinTime };
    }
  }

  return null;
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
    if (best === null || price < best.price) {
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
    const best = pickBestFish(fishData, player, ownedLures);
    if (!best) break;

    const { fish, avgFightTime } = best;
    const roundTime = 2 * SHOP_TRAVEL_TIME + CAST_WAIT_TIME + avgFightTime;
    const income = fish.basePrice;
    wallet += income;
    cumulativeTime += roundTime;

    const walletSnapshot = wallet;
    const upgradesBought: string[] = [];
    let boughtLure = false;

    let result = cheapestUpgrade(shopData, levels, wallet);
    while (result !== null) {
      const { upgrade, price } = result;
      wallet -= price;
      applyUpgrade(upgrade, player, ownedLures, levels);
      upgradesBought.push(`${upgrade.id} L${levels[upgrade.id]}`);
      if (upgrade.stat === StatName.LURE) boughtLure = true;
      result = cheapestUpgrade(shopData, levels, wallet);
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
