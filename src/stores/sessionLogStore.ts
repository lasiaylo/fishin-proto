import { create } from "zustand";
import { FishData } from "../util/csvLoader";
import { EconomyRound } from "../game/EconomyModel";
import { PlayerStats } from "./playerStore";
import { useLureXp } from "./lureXpStore";
import { computeLureLevel } from "../util/constants";

interface CatchRecord {
  fish: FishData;
  effectivePrice: number;
  duration: number;
  remainingHP: number; // fraction 0–1
  lureId: string;
}

interface LossRecord {
  fish: FishData;
  lureId: string;
}

interface CombatStat {
  wins: number;
  losses: number;
  totalTime: number;
  totalEarnings: number;
  totalRemainingHP: number;
}

interface SessionLogState {
  sessionStart: number;
  roundStart: number;
  roundCount: number;
  catches: CatchRecord[];
  losses: LossRecord[];
  pendingUpgrades: string[];
  pendingLureBought: boolean;
  upgradeLevels: Record<string, number>;
  fishStats: Record<string, CombatStat>;
  lureStats: Record<string, CombatStat>;
  completedRounds: EconomyRound[];

  logFishResult: (
    fish: FishData,
    won: boolean,
    duration: number,
    finalTension: number,
    lineHP: number,
    lureId: string,
    effectivePrice: number,
  ) => void;
  logUpgradeBought: (
    upgradeId: string,
    newLevel: number,
    isLure: boolean,
  ) => void;
  finalizeRound: (walletBeforeSell: number, playerStats: PlayerStats) => void;
  reset: () => void;
}

function emptyCombatStat(): CombatStat {
  return {
    wins: 0,
    losses: 0,
    totalTime: 0,
    totalEarnings: 0,
    totalRemainingHP: 0,
  };
}

function applyWin(
  stat: CombatStat,
  duration: number,
  earnings: number,
  remainingHP: number,
): CombatStat {
  return {
    ...stat,
    wins: stat.wins + 1,
    totalTime: stat.totalTime + duration,
    totalEarnings: stat.totalEarnings + earnings,
    totalRemainingHP: stat.totalRemainingHP + remainingHP,
  };
}

function applyLoss(stat: CombatStat, duration: number): CombatStat {
  return {
    ...stat,
    losses: stat.losses + 1,
    totalTime: stat.totalTime + duration,
  };
}

const now = () => Date.now() / 1000;

export const useSessionLog = create<SessionLogState>((set, get) => ({
  sessionStart: now(),
  roundStart: now(),
  roundCount: 0,
  catches: [],
  losses: [],
  pendingUpgrades: [],
  pendingLureBought: false,
  upgradeLevels: {},
  fishStats: {},
  lureStats: {},
  completedRounds: [],

  logFishResult(fish, won, duration, finalTension, lineHP, lureId, effectivePrice) {
    set((s) => {
      const fishStats = { ...s.fishStats };
      const lureStats = { ...s.lureStats };

      if (!fishStats[fish.id]) fishStats[fish.id] = emptyCombatStat();
      if (!lureStats[lureId]) lureStats[lureId] = emptyCombatStat();

      const remainingHP =
        lineHP > 0 ? Math.max(0, 1 - finalTension / lineHP) : 0;

      if (won) {
        fishStats[fish.id] = applyWin(
          fishStats[fish.id],
          duration,
          effectivePrice,
          remainingHP,
        );
        lureStats[lureId] = applyWin(
          lureStats[lureId],
          duration,
          effectivePrice,
          remainingHP,
        );
        return {
          catches: [...s.catches, { fish, effectivePrice, duration, remainingHP, lureId }],
          fishStats,
          lureStats,
        };
      } else {
        fishStats[fish.id] = applyLoss(fishStats[fish.id], duration);
        lureStats[lureId] = applyLoss(lureStats[lureId], duration);
        return {
          losses: [...s.losses, { fish, lureId }],
          fishStats,
          lureStats,
        };
      }
    });
  },

  logUpgradeBought(upgradeId, newLevel, isLure) {
    set((s) => ({
      pendingUpgrades: [...s.pendingUpgrades, `${upgradeId} L${newLevel}`],
      pendingLureBought: s.pendingLureBought || isLure,
      upgradeLevels: { ...s.upgradeLevels, [upgradeId]: newLevel },
    }));
  },

  finalizeRound(walletBeforeSell, playerStats) {
    const s = get();
    if (s.catches.length === 0 && s.losses.length === 0) return;

    const t = now();
    const roundTime = t - s.roundStart;
    const cumulativeTime = t - s.sessionStart;
    const roundCount = s.roundCount + 1;

    const income = s.catches.reduce((sum, c) => sum + c.effectivePrice, 0);
    const rate = roundTime > 0 ? income / roundTime : 0;

    const fightDuration =
      s.catches.length > 0
        ? s.catches.reduce((sum, c) => sum + c.duration, 0) / s.catches.length
        : 0;

    const lureId =
      s.catches.length > 0
        ? s.catches[s.catches.length - 1].lureId
        : s.losses.length > 0
          ? s.losses[s.losses.length - 1].lureId
          : "";

    // Per-species running averages
    const fishCatchTimes: Record<string, number> = {};
    const fishEarnings: Record<string, number> = {};
    for (const [id, stat] of Object.entries(s.fishStats)) {
      const total = stat.wins + stat.losses;
      if (total === 0) continue;
      fishCatchTimes[id] = stat.totalTime / total;
      fishEarnings[id] =
        stat.totalTime > 0 ? stat.totalEarnings / stat.totalTime : 0;
    }

    // Per-lure running averages
    const lureRates: Record<string, number> = {};
    const lureWinRates: Record<string, number> = {};
    const lureRemainingHP: Record<string, number> = {};
    for (const [id, stat] of Object.entries(s.lureStats)) {
      const total = stat.wins + stat.losses;
      if (total === 0) continue;
      lureWinRates[id] = stat.wins / total;
      lureRates[id] =
        stat.totalTime > 0 ? stat.totalEarnings / stat.totalTime : 0;
      if (stat.wins > 0)
        lureRemainingHP[id] = (stat.totalRemainingHP / stat.wins) * 100;
    }

    const boughtLure = s.pendingLureBought;

    const round: EconomyRound = {
      round: roundCount,
      cumulativeTime,
      roundTime,
      fightDuration,
      income,
      wallet: walletBeforeSell,
      rate,
      lureId,
      fishCatchTimes,
      fishEarnings,
      lureRates,
      lureWinRates,
      lureRemainingHP,
      upgradesBought: s.pendingUpgrades,
      upgradeLevels: { ...s.upgradeLevels },
      boughtLure,
      playerStats: { ...playerStats },
      lureXp: Object.fromEntries(
        Object.entries(useLureXp.getState().lures).map(([id, e]) => [id, e.xp]),
      ),
      lureLevels: Object.fromEntries(
        Object.entries(useLureXp.getState().lures).map(([id, e]) => [id, computeLureLevel(e.xp)]),
      ),
    };

    set({
      roundCount,
      completedRounds: [...s.completedRounds, round],
      catches: [],
      losses: [],
      pendingUpgrades: [],
      pendingLureBought: false,
      roundStart: t,
    });
  },

  reset() {
    const t = now();
    set({
      sessionStart: t,
      roundStart: t,
      roundCount: 0,
      catches: [],
      losses: [],
      pendingUpgrades: [],
      pendingLureBought: false,
      upgradeLevels: {},
      fishStats: {},
      lureStats: {},
      completedRounds: [],
    });
  },
}));
