import { FightEngine, Outcome } from "./FightEngine";
import type { FishData, ShopUpgradeData } from "../util/csvLoader";

// ── Constants ──

const SHOP_TRAVEL_TIME = 5;
const CAST_WAIT_TIME = 5;
const EVAL_TRIALS = 500;
const MAX_FIGHT_TIME = 30;
const MAX_ROUNDS = 100;

// ── Types ──

export interface SimPlayer {
  attack: number;
  defense: number;
  lineHP: number;
}

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

export const DEFAULT_SIM_PLAYER: SimPlayer = {
  attack: 3,
  defense: 3,
  lineHP: 20,
};

// ── Helpers ──

function runTrials(
  fish: FishData,
  player: SimPlayer,
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
  player: SimPlayer,
  ownedLures: Set<string>,
): { fish: FishData; avgFightTime: number } | null {
  const sorted = [...fishData].sort((a, b) => b.basePrice - a.basePrice);

  for (const fish of sorted) {
    if (fish.requiredLure && !ownedLures.has(fish.requiredLure)) continue;

    const { winCount, avgWinTime } = runTrials(fish, player, EVAL_TRIALS);
    if (winCount > 0 && avgWinTime <= MAX_FIGHT_TIME) {
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
  player: SimPlayer,
  ownedLures: Set<string>,
  levels: Record<string, number>,
): void {
  levels[upgrade.id] = (levels[upgrade.id] ?? 0) + 1;

  switch (upgrade.stat) {
    case "lure":
      ownedLures.add(upgrade.id);
      break;
    case "reelStrength":
      player.attack += upgrade.valuePerLevel;
      break;
    case "drag":
      player.defense += upgrade.valuePerLevel;
      break;
    case "lineStrength":
      player.lineHP += upgrade.valuePerLevel;
      break;
    // other stats (e.g. "win", "inventory") are money sinks with no mechanical effect
  }
}

// ── Main export ──

export function simulateEconomy(
  fishData: FishData[],
  shopData: ShopUpgradeData[],
  start: SimPlayer = DEFAULT_SIM_PLAYER,
): EconomyRound[] {
  const player: SimPlayer = { ...start };
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
      if (upgrade.stat === "lure") boughtLure = true;
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
