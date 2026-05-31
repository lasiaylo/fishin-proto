export interface FishData {
  id: string;
  name: string;
  basePrice: number;
  attack: number;
  defense: number;
  requiredLure: string;
  thrash: number;
}

export enum StatName {
  ATTACK = "ATTACK",
  DEFENSE = "DEFENSE",
  HP = "HP",
  LURE = "LURE",
  WIN = "win",
}

const STAT_NAME_VALUES = new Set<string>(Object.values(StatName));

function parseStatName(value: string): StatName {
  if (STAT_NAME_VALUES.has(value)) return value as StatName;
  throw new Error(`Invalid stat name in CSV: "${value}"`);
}

export interface ShopUpgradeData {
  id: string;
  name: string;
  description: string;
  prices: number[];
  stat: StatName;
  valuePerLevel: number;
}

function parseCSV(text: string): string[][] {
  return text
    .trim()
    .split("\n")
    .map((line) => line.split(",").map((cell) => cell.trim()));
}

export async function loadFishData(): Promise<FishData[]> {
  const [gameplayRes, displayRes] = await Promise.all([
    fetch("/data/FishGameplay.csv"),
    fetch("/data/FishDisplay.csv"),
  ]);
  const [gameplayRows, displayRows] = [
    parseCSV(await gameplayRes.text()),
    parseCSV(await displayRes.text()),
  ];

  const displayById = new Map(
    displayRows.slice(1).map((row) => [row[0], row[1]]),
  );

  return gameplayRows.slice(1).map((row) => ({
    id: row[0],
    name: displayById.get(row[0]) ?? row[0],
    basePrice: Number(row[1]),
    attack: Number(row[2]),
    defense: Number(row[3]),
    thrash: Number(row[4]) || 0,
    requiredLure: row[5] || "",
  }));
}

export async function loadShopGameplayData(): Promise<ShopUpgradeData[]> {
  const res = await fetch("/data/ShopGameplay.csv");
  const rows = parseCSV(await res.text());
  return rows.slice(1).map((row) => ({
    id: row[0],
    name: row[0],
    description: "",
    prices: row[1].split(" ").map(Number),
    stat: parseStatName(row[2]),
    valuePerLevel: Number(row[3]),
  }));
}

export async function loadShopData(): Promise<ShopUpgradeData[]> {
  const [gameplayRes, displayRes] = await Promise.all([
    fetch("/data/ShopGameplay.csv"),
    fetch("/data/ShopDisplay.csv"),
  ]);
  const [gameplayRows, displayRows] = [
    parseCSV(await gameplayRes.text()),
    parseCSV(await displayRes.text()),
  ];

  const displayById = new Map(
    displayRows
      .slice(1)
      .map((row) => [row[0], { name: row[1], description: row[2] }]),
  );

  return gameplayRows.slice(1).map((row) => {
    const display = displayById.get(row[0]);
    return {
      id: row[0],
      name: display?.name ?? row[0],
      description: display?.description ?? "",
      prices: row[1].split(" ").map(Number),
      stat: parseStatName(row[2]),
      valuePerLevel: Number(row[3]),
    };
  });
}
