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
  INVENTORY = "INVENTORY",
  WIN = "win",
}

const STAT_NAME_VALUES = new Set<string>(Object.values(StatName));

function parseStatName(value: string): StatName {
  if (STAT_NAME_VALUES.has(value)) return value as StatName;
  throw new Error(`Invalid stat name in CSV: "${value}"`);
}

export interface LocationDisplayData {
  id: string;
  name: string;
  description: string;
}

export interface LocationFishEntry {
  locationId: string;
  fishId: string;
  percent: number;
}

export interface ShopUpgradeData {
  id: string;
  name: string;
  description: string;
  category: string;
  prices: number[];
  stat: StatName;
  valuePerLevel: number;
  requirements: string[];
}

function parseCSV(text: string): string[][] {
  return text
    .trim()
    .split("\n")
    .filter((line) => line.trim() !== "" && !line.trim().startsWith("#"))
    .map((line) => line.split(",").map((cell) => cell.trim()));
}

export async function loadFishData(
  fishFile = "FishGameplay.csv",
): Promise<FishData[]> {
  const [gameplayRes, displayRes] = await Promise.all([
    fetch(`/data/Fish/${fishFile}`),
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
    attack: Number(row[1]),
    defense: Number(row[2]),
    thrash: Number(row[3]) || 0,
    basePrice: Number(row[4]),
    requiredLure: row[5] || "",
  }));
}

export async function loadLocationDisplayData(): Promise<
  LocationDisplayData[]
> {
  const res = await fetch("/data/LocationDisplay.csv");
  const rows = parseCSV(await res.text());
  return rows.slice(1).map((row) => ({
    id: row[0],
    name: row[1],
    description: row[2] ?? "",
  }));
}

export async function loadLocationGameplayData(): Promise<LocationFishEntry[]> {
  const res = await fetch("/data/LocationGameplay.csv");
  const rows = parseCSV(await res.text());
  return rows.slice(1).map((row) => ({
    locationId: row[0],
    fishId: row[1],
    percent: Number(row[2]),
  }));
}

export async function loadShopGameplayData(
  shopFile = "ShopGameplay.csv",
): Promise<ShopUpgradeData[]> {
  const res = await fetch(`/data/Shop/${shopFile}`);
  const rows = parseCSV(await res.text());
  return rows.slice(1).map((row) => ({
    id: row[0],
    name: row[0],
    description: "",
    category: "",
    prices: row[1].split(" ").map(Number),
    stat: parseStatName(row[2]),
    valuePerLevel: Number(row[3]),
    requirements: row[4] ? row[4].split(" ").filter(Boolean) : [],
  }));
}

export function parseFishGameplayRows(rows: string[][]): FishData[] {
  return rows.slice(1).map((row) => ({
    id: row[0],
    name: row[0],
    attack: Number(row[1]),
    defense: Number(row[2]),
    thrash: Number(row[3]) || 0,
    basePrice: Number(row[4]),
    requiredLure: row[5] || "",
  }));
}

export function parseShopGameplayRows(rows: string[][]): ShopUpgradeData[] {
  return rows.slice(1).map((row) => ({
    id: row[0],
    name: row[0],
    description: "",
    category: "",
    prices: row[1].split(" ").map(Number),
    stat: parseStatName(row[2]),
    valuePerLevel: Number(row[3]),
    requirements: row[4] ? row[4].split(" ").filter(Boolean) : [],
  }));
}

export async function loadShopData(
  shopFile = "ShopGameplay.csv",
): Promise<ShopUpgradeData[]> {
  const [gameplayRes, displayRes] = await Promise.all([
    fetch(`/data/Shop/${shopFile}`),
    fetch("/data/ShopDisplay.csv"),
  ]);
  const [gameplayRows, displayRows] = [
    parseCSV(await gameplayRes.text()),
    parseCSV(await displayRes.text()),
  ];

  const displayById = new Map(
    displayRows
      .slice(1)
      .map((row) => [
        row[0],
        { name: row[1], description: row[2], category: row[3] ?? "" },
      ]),
  );

  return gameplayRows.slice(1).map((row) => {
    const display = displayById.get(row[0]);
    return {
      id: row[0],
      name: display?.name ?? row[0],
      description: display?.description ?? "",
      category: display?.category ?? "",
      prices: row[1].split(" ").map(Number),
      stat: parseStatName(row[2]),
      valuePerLevel: Number(row[3]),
      requirements: row[4] ? row[4].split(" ").filter(Boolean) : [],
    };
  });
}
