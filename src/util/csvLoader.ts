import { Rarity, Zone } from "./constants";

export interface FishData {
  id: string;
  name: string;
  basePrice: number;
  attack: number;
  defense: number;
  requiredTackle: string;
  thrash: number;
  zones: Zone[];
  hp: number;
  rarity?: Rarity;
}

export enum StatName {
  LURE = "LURE",
  WIN = "win",
  BAIT = "BAIT",
  ROD = "ROD",
  ROD_ATTACK = "ROD_ATTACK",
  ROD_DEFENSE = "ROD_DEFENSE",
  ROD_SLOT = "ROD_SLOT",
  INCOME = "INCOME",
}

export interface BaitData {
  id: string;
  name: string;
  waitMin: number;
  waitMax: number;
}

export interface RodData {
  id: string;
  attackLevels: number[];
  defenseLevels: number[];
  castMax: number;
  speedMultiplier: number;
  reelMaxSpeed: number;
}

const STAT_NAME_VALUES = new Set<string>(Object.values(StatName));

export async function loadBaitData(
  baitFile = "BaitGameplay.csv",
): Promise<BaitData[]> {
  const [gameplayRes, displayRes] = await Promise.all([
    fetch(`/data/Bait/${baitFile}`),
    fetch("/data/ShopDisplay.csv"),
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
    waitMin: Number(row[1]),
    waitMax: Number(row[2]),
  }));
}

export async function loadRodData(
  rodFile = "RodGameplay.csv",
): Promise<RodData[]> {
  const res = await fetch(`/data/Rod/${rodFile}`);
  const rows = parseCSV(await res.text());
  return rows.slice(1).map((row) => ({
    id: row[0],
    attackLevels: row[1].split(" ").map(Number),
    defenseLevels: row[2].split(" ").map(Number),
    castMax: Number(row[3]),
    speedMultiplier: Number(row[4]),
    reelMaxSpeed: Number(row[5]),
  }));
}

export function levelStat(levels: number[], level: number): number {
  if (levels.length === 0) {
    throw new Error("levelStat: no levels defined");
  }
  return levels[Math.min(Math.max(level, 0), levels.length - 1)];
}

function parseStatName(value: string): StatName {
  if (STAT_NAME_VALUES.has(value)) return value as StatName;
  throw new Error(`Invalid stat name in CSV: "${value}"`);
}

export interface TipData {
  id: string;
  title: string;
  text: string;
}

export async function loadTipData(tipFile = "Tips.csv"): Promise<TipData[]> {
  const res = await fetch(`/data/${tipFile}`);
  const rows = parseCSV(await res.text());
  return rows.slice(1).map((row) => ({
    id: row[0],
    title: row[1],
    text: row[2],
  }));
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
  subcategory: string;
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
    ...parseFishRow(row),
    name: displayById.get(row[0]) ?? row[0],
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

export interface ShopCsvLocation {
  folder?: string;
  displayFile?: string;
}

const DEFAULT_SHOP_LOCATION: Required<ShopCsvLocation> = {
  folder: "Shop",
  displayFile: "ShopDisplay.csv",
};

export async function loadShopGameplayData(
  shopFile = "ShopGameplay.csv",
  location: ShopCsvLocation = {},
): Promise<ShopUpgradeData[]> {
  const { folder } = { ...DEFAULT_SHOP_LOCATION, ...location };
  const res = await fetch(`/data/${folder}/${shopFile}`);
  const rows = parseCSV(await res.text());
  return rows.slice(1).map((row) => ({
    id: row[0],
    name: row[0],
    description: "",
    category: "",
    subcategory: "",
    prices: row[1].split(" ").map(Number),
    stat: parseStatName(row[2]),
    valuePerLevel: Number(row[3]),
    requirements: row[4] ? row[4].split(" ").filter(Boolean) : [],
  }));
}

function parseFishRow(row: string[]): FishData {
  return {
    id: row[0],
    name: row[0],
    attack: Number(row[1]),
    defense: Number(row[2]),
    thrash: Number(row[3]) || 0,
    basePrice: Number(row[4]),
    requiredTackle: row[5] || "",
    zones: row[6] ? (row[6].split(" ").filter(Boolean) as Zone[]) : [],
    hp: Number(row[7]) || 0,
  };
}

export async function loadFishDisplayMap(): Promise<Map<string, string>> {
  const res = await fetch("/data/FishDisplay.csv");
  const rows = parseCSV(await res.text());
  return new Map(rows.slice(1).map((row) => [row[0], row[1]]));
}

export function parseFishGameplayRows(
  rows: string[][],
  displayMap?: Map<string, string>,
): FishData[] {
  return rows.slice(1).map((row) => ({
    ...parseFishRow(row),
    name: displayMap?.get(row[0]) ?? row[0],
  }));
}

function categoryFromStat(stat: StatName): string {
  if (stat === StatName.LURE) return "lures";
  if (stat === StatName.BAIT) return "bait";
  if (
    stat === StatName.ROD ||
    stat === StatName.ROD_ATTACK ||
    stat === StatName.ROD_DEFENSE
  )
    return "rods";
  return "misc";
}

interface ShopDisplayEntry {
  name: string;
  description: string;
  category: string;
  subcategory: string;
}

function parseShopDisplayRow(row: string[]): ShopDisplayEntry {
  return {
    name: row[1],
    description: row[2],
    category: row[3] ?? "",
    subcategory: row[4] ?? "",
  };
}

export async function loadShopDisplayMap(): Promise<
  Map<string, ShopDisplayEntry>
> {
  const res = await fetch("/data/ShopDisplay.csv");
  const rows = parseCSV(await res.text());
  return new Map(
    rows.slice(1).map((row) => [row[0], parseShopDisplayRow(row)]),
  );
}

export function parseShopGameplayRows(
  rows: string[][],
  displayMap?: Map<string, ShopDisplayEntry>,
): ShopUpgradeData[] {
  return rows.slice(1).map((row) => {
    const stat = parseStatName(row[2]);
    const display = displayMap?.get(row[0]);
    return {
      id: row[0],
      name: display?.name ?? row[0],
      description: display?.description ?? "",
      category: display?.category ?? categoryFromStat(stat),
      subcategory: display?.subcategory ?? "",
      prices: row[1].split(" ").map(Number),
      stat,
      valuePerLevel: Number(row[3]),
      requirements: row[4] ? row[4].split(" ").filter(Boolean) : [],
    };
  });
}

export async function loadShopData(
  shopFile = "ShopGameplay.csv",
  location: ShopCsvLocation = {},
): Promise<ShopUpgradeData[]> {
  const { folder, displayFile } = { ...DEFAULT_SHOP_LOCATION, ...location };
  const [gameplayRes, displayRes] = await Promise.all([
    fetch(`/data/${folder}/${shopFile}`),
    fetch(`/data/${displayFile}`),
  ]);
  const [gameplayRows, displayRows] = [
    parseCSV(await gameplayRes.text()),
    parseCSV(await displayRes.text()),
  ];

  const displayById = new Map(
    displayRows.slice(1).map((row) => [row[0], parseShopDisplayRow(row)]),
  );

  return gameplayRows.slice(1).map((row) => {
    const display = displayById.get(row[0]);
    return {
      id: row[0],
      name: display?.name ?? row[0],
      description: display?.description ?? "",
      category: display?.category ?? "",
      subcategory: display?.subcategory ?? "",
      prices: row[1].split(" ").map(Number),
      stat: parseStatName(row[2]),
      valuePerLevel: Number(row[3]),
      requirements: row[4] ? row[4].split(" ").filter(Boolean) : [],
    };
  });
}
