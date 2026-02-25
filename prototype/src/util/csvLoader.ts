export interface FishData {
  id: string;
  name: string;
  basePrice: number;
  baseWeight: number;
  strength: number;
  speed: number;
  requiredLure: string;
}

export interface ShopUpgradeData {
  id: string;
  prices: number[];
  stat: string;
  valuePerLevel: number;
}

function parseCSV(text: string): string[][] {
  return text
    .trim()
    .split("\n")
    .map((line) => line.split(",").map((cell) => cell.trim()));
}

export async function loadFishData(): Promise<FishData[]> {
  const res = await fetch("/data/FishGameplay.csv");
  const text = await res.text();
  const rows = parseCSV(text);
  // Skip header row
  return rows.slice(1).map((row) => ({
    id: row[0],
    name: row[1],
    basePrice: Number(row[2]),
    baseWeight: Number(row[3]),
    strength: Number(row[4]),
    speed: Number(row[5]),
    requiredLure: row[6] || "",
  }));
}

export async function loadShopData(): Promise<ShopUpgradeData[]> {
  const res = await fetch("/data/ShopGameplay.csv");
  const text = await res.text();
  const rows = parseCSV(text);
  // Skip header row
  return rows.slice(1).map((row) => ({
    id: row[0],
    prices: row[1].split(" ").map(Number),
    stat: row[2],
    valuePerLevel: Number(row[3]),
  }));
}
