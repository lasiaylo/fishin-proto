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
  "boughtLure",
  "rodAtk",
  "rodDef",
  "lineHP",
  "inventorySize",
  "upgradesBought",
  "upgradeLevels",
  "fishCatchTimes",
  "fishEarnings",
  "lureRates",
  "lureWinRates",
  "lureRemainingHP",
  "lureXp",
  "lureLevels",
] as const;

function escapeCell(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function roundsToCSV(rounds: EconomyRound[]): string {
  const rows: string[] = [HEADERS.join(",")];
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
      r.boughtLure ? "1" : "0",
      r.rodStats[0]?.attack ?? 0,
      r.rodStats[0]?.defense ?? 0,
      r.playerStats.lineHP,
      r.playerStats.inventorySize,
      JSON.stringify(r.upgradesBought),
      JSON.stringify(r.upgradeLevels),
      JSON.stringify(r.fishCatchTimes),
      JSON.stringify(r.fishEarnings),
      JSON.stringify(r.lureRates),
      JSON.stringify(r.lureWinRates),
      JSON.stringify(r.lureRemainingHP),
      JSON.stringify(r.lureXp),
      JSON.stringify(r.lureLevels),
    ].map((v) => escapeCell(String(v)));
    rows.push(cells.join(","));
  }
  return rows.join("\n");
}

function parseCSVRow(line: string): string[] {
  const cells: string[] = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] === '"') {
      let cell = "";
      i++;
      while (i < line.length) {
        if (line[i] === '"' && line[i + 1] === '"') {
          cell += '"';
          i += 2;
        } else if (line[i] === '"') {
          i++;
          break;
        } else {
          cell += line[i++];
        }
      }
      cells.push(cell);
      if (line[i] === ",") i++;
    } else {
      const end = line.indexOf(",", i);
      if (end === -1) {
        cells.push(line.slice(i));
        break;
      }
      cells.push(line.slice(i, end));
      i = end + 1;
    }
  }
  return cells;
}

export function csvToRounds(csv: string): EconomyRound[] {
  const lines = csv.trim().split("\n");
  if (lines.length < 2) return [];
  const header = parseCSVRow(lines[0]);
  const idx = Object.fromEntries(header.map((h, i) => [h.trim(), i]));

  return lines.slice(1).map((line) => {
    const c = parseCSVRow(line);
    const get = (key: string) => c[idx[key]] ?? "";
    const arr = (key: string) => JSON.parse(get(key) || "[]");
    const obj = (key: string) => JSON.parse(get(key) || "{}");
    const rodAtk = Number(get("rodAtk"));
    const rodDef = Number(get("rodDef"));
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
      boughtLure: get("boughtLure") === "1",
      rodCount: 1,
      playerStats: {
        lineHP: Number(get("lineHP")),
        inventorySize: Number(get("inventorySize")),
      },
      rodStats: [
        { id: "ROD_1", attack: rodAtk, defense: rodDef, castMax: CAST_MAX },
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
