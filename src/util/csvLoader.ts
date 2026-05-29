export interface FishData {
  id: string;
  name: string;
  basePrice: number;
  attack: number;
  defense: number;
  requiredLure: string;
}

export interface ShopUpgradeData {
  id: string;
  name: string;
  description: string;
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
    attack: Number(row[3]),
    defense: Number(row[4]),
    requiredLure: row[5] || "",
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
      stat: row[2],
      valuePerLevel: Number(row[3]),
    };
  });
}
