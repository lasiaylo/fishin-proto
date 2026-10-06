import Papa from "papaparse";
import { EconomyRound } from "../game/EconomyModel";
import { CAST_MAX } from "../util/constants";

const HEADERS = [
  "round",
  "cumulativeTime",
  "roundTime",
  "fightDuration",
  "income",
  "netIncome",
  "wallet",
  "rate",
  "lureId",
  "baitId",
  "boughtLure",
  "rodAtk",
  "rodDef",
  "rodSpeedMult",
  "lineHP",
  "fishPerRound",
  "incomeBoostPercent",
  "upgradesBought",
  "upgradeLevels",
  "fishCatchTimes",
  "fishEarnings",
  "lureRates",
  "lureWinRates",
  "lureRemainingHP",
  "lureXp",
  "lureLevels",
  "cumulativeMoneyEarned",
  "dreamPoints",
] as const;

export function roundsToCSV(rounds: EconomyRound[]): string {
  const rows: string[][] = [[...HEADERS]];
  for (const r of rounds) {
    const cells = [
      r.round,
      r.cumulativeTime.toFixed(3),
      r.roundTime.toFixed(3),
      r.fightDuration.toFixed(3),
      r.income.toFixed(4),
      r.netIncome.toFixed(4),
      r.wallet.toFixed(4),
      r.rate.toFixed(6),
      r.lureId,
      r.baitId,
      r.boughtLure ? "1" : "0",
      r.rodStats[0]?.attack ?? 0,
      r.rodStats[0]?.defense ?? 0,
      r.rodStats[0]?.speedMultiplier ?? 1,
      r.rodStats[0]?.lineHP ?? 0,
      r.playerStats.fishPerRound,
      r.playerStats.incomeBoostPercent,
      JSON.stringify(r.upgradesBought),
      JSON.stringify(r.upgradeLevels),
      JSON.stringify(r.fishCatchTimes),
      JSON.stringify(r.fishEarnings),
      JSON.stringify(r.lureRates),
      JSON.stringify(r.lureWinRates),
      JSON.stringify(r.lureRemainingHP),
      JSON.stringify(r.lureXp),
      JSON.stringify(r.lureLevels),
      r.cumulativeMoneyEarned.toFixed(4),
      r.dreamPoints.toFixed(4),
    ].map(String);
    rows.push(cells);
  }
  return Papa.unparse(rows, { newline: "\n" });
}

export function csvToRounds(csv: string): EconomyRound[] {
  const { data } = Papa.parse<Record<string, string>>(csv.trim(), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  return data.map((row) => {
    const get = (key: string) => row[key] ?? "";
    const arr = (key: string) => JSON.parse(get(key) || "[]");
    const obj = (key: string) => JSON.parse(get(key) || "{}");
    const rodAtk = Number(get("rodAtk"));
    const rodDef = Number(get("rodDef"));
    const rodSpeedMult = Number(get("rodSpeedMult") || "1");
    return {
      round: Number(get("round")),
      cumulativeTime: Number(get("cumulativeTime")),
      roundTime: Number(get("roundTime")),
      fightDuration: Number(get("fightDuration")),
      income: Number(get("income")),
      netIncome: Number(get("netIncome") || get("income")),
      wallet: Number(get("wallet")),
      rate: Number(get("rate")),
      lureId: get("lureId"),
      baitId: get("baitId"),
      boughtLure: get("boughtLure") === "1",
      rodCount: 1,
      playerStats: {
        fishPerRound: Number(get("fishPerRound")),
        incomeBoostPercent: Number(get("incomeBoostPercent")),
      },
      rodStats: [
        {
          id: "ROD_1",
          attack: rodAtk,
          defense: rodDef,
          lineHP: Number(get("lineHP")),
          castMax: CAST_MAX,
          speedMultiplier: rodSpeedMult,
        },
      ],
      fishCatchTimes: obj("fishCatchTimes"),
      fishEarnings: obj("fishEarnings"),
      lureRates: obj("lureRates"),
      lureWinRates: obj("lureWinRates"),
      lureRemainingHP: obj("lureRemainingHP"),
      upgradesBought: arr("upgradesBought"),
      upgradeLevels: obj("upgradeLevels"),
      lureXp: obj("lureXp"),
      lureLevels: obj("lureLevels"),
      cumulativeMoneyEarned: Number(get("cumulativeMoneyEarned")),
      dreamPoints: Number(get("dreamPoints")),
    };
  });
}

export function downloadCSV(rounds: EconomyRound[], filename = "session.csv") {
  const csv = roundsToCSV(rounds);
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
