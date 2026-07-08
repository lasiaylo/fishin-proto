import React, { useEffect, useState } from "react";
import { Flex, Grid, Text, Table, Button, Separator } from "@radix-ui/themes";
import { NumInput } from "./shared";

export const GENERATED_FISH_CSV = "__generated_fish__";
export const GENERATED_SHOP_CSV = "__generated_shop__";
const LURE_REQ_GAP = 3;

const FISH_STORAGE_KEY = "csvgen_fish";
const SHOP_STORAGE_KEY = "csvgen_shop";
const SHARED_STORAGE_KEY = "csvgen_shared";

function loadStored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return { ...fallback, ...JSON.parse(raw) };
  } catch {}
  return fallback;
}

type FnType = "LINEAR" | "POLYNOMIAL" | "EXPONENTIAL";

interface FunctionConfig {
  type: FnType;
  startValue: number;
  scaleFactor: number;
  growthRate: number;
}

const DEFAULT_ATTACK_FN: FunctionConfig = {
  type: "LINEAR",
  startValue: 2,
  scaleFactor: 4,
  growthRate: 0.8,
};
const DEFAULT_DEFENSE_FN: FunctionConfig = {
  type: "LINEAR",
  startValue: 2,
  scaleFactor: 4,
  growthRate: 0.8,
};
const DEFAULT_PRICE_FN: FunctionConfig = {
  type: "LINEAR",
  startValue: 4,
  scaleFactor: 4,
  growthRate: 0.8,
};
const DEFAULT_STAT_FN: FunctionConfig = {
  type: "LINEAR",
  startValue: 20,
  scaleFactor: 4,
  growthRate: 0.8,
};
const DEFAULT_LURE_FN: FunctionConfig = {
  type: "LINEAR",
  startValue: 10,
  scaleFactor: 4,
  growthRate: 0.8,
};

const DEFAULT_BAIT_FN: FunctionConfig = {
  type: "LINEAR",
  startValue: 5,
  scaleFactor: 5,
  growthRate: 0.8,
};
const DEFAULT_BAIT_ATTACK_FN: FunctionConfig = {
  type: "LINEAR",
  startValue: 2,
  scaleFactor: 4,
  growthRate: 0.8,
};
const DEFAULT_BAIT_DEFENSE_FN: FunctionConfig = {
  type: "LINEAR",
  startValue: 2,
  scaleFactor: 4,
  growthRate: 0.8,
};
const DEFAULT_BAIT_PRICE_FN: FunctionConfig = {
  type: "LINEAR",
  startValue: 4,
  scaleFactor: 4,
  growthRate: 0.8,
};
const DEFAULT_ROD_PURCHASE_FN: FunctionConfig = {
  type: "LINEAR",
  startValue: 50,
  scaleFactor: 50,
  growthRate: 0.8,
};
const DEFAULT_ROD_HOLDER_FN: FunctionConfig = {
  type: "LINEAR",
  startValue: 40,
  scaleFactor: 40,
  growthRate: 0.8,
};

function evalFn(cfg: FunctionConfig, lvl: number): number {
  if (cfg.type === "LINEAR") return cfg.startValue + cfg.scaleFactor * lvl;
  if (cfg.type === "POLYNOMIAL")
    return cfg.startValue + cfg.scaleFactor * Math.pow(lvl, cfg.growthRate);
  return cfg.startValue * Math.pow(cfg.growthRate, lvl);
}

function generateFishPool(
  attackFn: FunctionConfig,
  defenseFn: FunctionConfig,
  priceFn: FunctionConfig,
  variance: number,
  levelStart: number,
  levelEnd: number,
  tackleId: (l: number) => string,
  fishId: (i: number) => string,
  hp: string,
  singleFirst = false,
): string[][] {
  const rows: string[][] = [];
  let idx = 0;
  for (let l = levelStart; l <= levelEnd; l++) {
    const mults = singleFirst && l === levelStart ? [1] : [1, 1 + variance];
    for (const mult of mults) {
      const atk = Math.ceil(evalFn(attackFn, l * mult));
      const def = Math.ceil(evalFn(defenseFn, l * mult));
      const p = Math.ceil(evalFn(priceFn, l * mult));
      rows.push([
        fishId(idx++),
        String(atk),
        String(def),
        "1",
        String(p),
        tackleId(l),
        "CLOSE",
        hp,
      ]);
    }
  }
  return rows;
}

function generateFishRows(
  attackFn: FunctionConfig,
  defenseFn: FunctionConfig,
  priceFn: FunctionConfig,
  baitAttackFn: FunctionConfig,
  baitDefenseFn: FunctionConfig,
  baitPriceFn: FunctionConfig,
  variance: number,
  levels: number,
): string[][] {
  const header = [
    ["ID", "ATK", "DEF", "Thrash", "BasePrice", "RequiredTackle", "Zone", "HP"],
  ];
  const baitRows = generateFishPool(
    baitAttackFn,
    baitDefenseFn,
    baitPriceFn,
    variance,
    0,
    levels,
    (b) => `BAIT_${b}`,
    (i) => `FISH_B_${i}`,
    "30",
    true,
  );
  const lureRows = generateFishPool(
    attackFn,
    defenseFn,
    priceFn,
    variance,
    1,
    levels,
    (l) => `LURE_${l}`,
    (i) => `FISH_${i}`,
    "40",
  );
  return [...header, ...baitRows, ...lureRows];
}

function priceList(fn: FunctionConfig, count: number): string {
  return Array.from({ length: count }, (_, i) => Math.ceil(evalFn(fn, i))).join(
    " ",
  );
}

function generateShopRows(
  attackFn: FunctionConfig,
  attackVPL: number,
  attackCount: number,
  defenseFn: FunctionConfig,
  defenseVPL: number,
  defenseCount: number,
  lureFn: FunctionConfig,
  lureCount: number,
  baitFn: FunctionConfig,
  baitCount: number,
  rodCount: number,
  rodPurchaseFn: FunctionConfig,
  rodHolderFn: FunctionConfig,
  rodHolderLevels: number,
): string[][] {
  const rows: string[][] = [
    ["ID", "Price", "Stat", "ValuePerLevel", "Requirement"],
  ];

  for (let r = 1; r <= rodCount; r++) {
    const rodId = `ROD_${r}`;
    const prevRodId = r > 1 ? `ROD_${r - 1}` : "";
    if (r > 1) {
      rows.push([
        rodId,
        String(Math.ceil(evalFn(rodPurchaseFn, r - 2))),
        "ROD",
        "1",
        prevRodId,
      ]);
    }
    rows.push([
      `${rodId}_ATTACK`,
      priceList(attackFn, attackCount),
      "ROD_ATTACK",
      String(attackVPL),
      r > 1 ? rodId : "",
    ]);
    rows.push([
      `${rodId}_DEFENSE`,
      priceList(defenseFn, defenseCount),
      "ROD_DEFENSE",
      String(defenseVPL),
      r > 1 ? rodId : "",
    ]);
  }

  for (let i = 0; i < lureCount; i++) {
    rows.push([
      `LURE_${i + 1}`,
      String(Math.ceil(evalFn(lureFn, i))),
      "LURE",
      "1",
      i >= LURE_REQ_GAP ? `LURE_${i - (LURE_REQ_GAP - 1)}` : "",
    ]);
  }

  for (let i = 0; i < baitCount; i++) {
    rows.push([`BAIT_${i}`, String(Math.ceil(evalFn(baitFn, i))), "BAIT", "1"]);
  }

  if (rodHolderLevels > 0) {
    rows.push([
      "ROD_HOLDER",
      priceList(rodHolderFn, rodHolderLevels),
      "ROD_SLOT",
      "1",
      rodCount > 1 ? "ROD_2" : "",
    ]);
  }

  return rows;
}

function fnConfigStr(cfg: FunctionConfig): string {
  if (cfg.type === "LINEAR")
    return `LINEAR startValue=${cfg.startValue} scaleFactor=${cfg.scaleFactor}`;
  if (cfg.type === "EXPONENTIAL")
    return `EXPONENTIAL startValue=${cfg.startValue} growthRate=${cfg.growthRate}`;
  return `POLYNOMIAL startValue=${cfg.startValue} scaleFactor=${cfg.scaleFactor} growthRate=${cfg.growthRate}`;
}

function downloadCsv(rows: string[][], filename: string, comment?: string) {
  const body = rows.map((r) => r.join(",")).join("\n");
  const csv = comment ? `${comment}\n${body}` : body;
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function FunctionSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: FunctionConfig;
  onChange: (v: FunctionConfig) => void;
}) {
  return (
    <Flex direction="column" gap="1">
      <Text size="1" color="gray">
        {label}
      </Text>
      <Flex gap="2" align="end" wrap="wrap">
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <Text size="1" color="gray">
            Function
          </Text>
          <select
            value={value.type}
            onChange={(e) =>
              onChange({ ...value, type: e.target.value as FnType })
            }
          >
            <option value="LINEAR">LINEAR</option>
            <option value="POLYNOMIAL">POLYNOMIAL</option>
            <option value="EXPONENTIAL">EXPONENTIAL</option>
          </select>
        </label>
        <NumInput
          label="StartValue"
          value={value.startValue}
          onChange={(v) => onChange({ ...value, startValue: v })}
          min={-999}
          max={99999}
          step={1}
        />
        {value.type !== "EXPONENTIAL" && (
          <NumInput
            label="ScaleFactor"
            value={value.scaleFactor}
            onChange={(v) => onChange({ ...value, scaleFactor: v })}
            min={-999}
            max={99999}
            step={0.5}
          />
        )}
        {(value.type === "POLYNOMIAL" || value.type === "EXPONENTIAL") && (
          <NumInput
            label="GrowthRate"
            value={value.growthRate}
            onChange={(v) => onChange({ ...value, growthRate: v })}
            min={0}
            max={2}
            step={0.01}
          />
        )}
      </Flex>
    </Flex>
  );
}

function computeLureCostTable(
  fishRows: string[][],
  shopRows: string[][],
  startingAD: number,
): {
  lureId: string;
  lurePrice: number;
  fishNeeded: number;
  adUpgradeCost: number;
  adFishNeeded: number;
  totalFishNeeded: number;
}[] {
  if (fishRows.length < 2 || shopRows.length < 2) return [];

  // Group fish by RequiredTackle, preserving insertion order (min, mid, max)
  const poolFish = new Map<string, { ad: number; price: number }[]>();
  for (const row of fishRows.slice(1)) {
    const requiredTackle = row[5] ?? "";
    const ad = Number(row[1]);
    const price = Number(row[4]);
    if (!poolFish.has(requiredTackle)) poolFish.set(requiredTackle, []);
    poolFish.get(requiredTackle)!.push({ ad, price });
  }

  const avgPrice = (lureId: string) => {
    const fish = poolFish.get(lureId);
    if (!fish || fish.length === 0) return 0;
    return fish.reduce((s, f) => s + f.price, 0) / fish.length;
  };

  // Middle fish A/D (index 1 for 3-fish pools, 0 for the single no-lure fish)
  const midAD = (lureId: string) => {
    const fish = poolFish.get(lureId);
    if (!fish || fish.length === 0) return 0;
    return fish[Math.floor(fish.length / 2)].ad;
  };

  // Parse ATTACK and DEFENSE shop rows
  const body = shopRows.slice(1);
  const attackRow = body.find((r) => r[0] === "ATTACK");
  const defenseRow = body.find((r) => r[0] === "DEFENSE");
  const attackPrices = attackRow ? attackRow[1].split(" ").map(Number) : [];
  const attackVPL = attackRow ? Number(attackRow[3]) : 1;
  const defensePrices = defenseRow ? defenseRow[1].split(" ").map(Number) : [];
  const defenseVPL = defenseRow ? Number(defenseRow[3]) : 1;

  const sumSlice = (prices: number[], from: number, count: number) => {
    let total = 0;
    for (let i = from; i < from + count && i < prices.length; i++)
      total += prices[i];
    return total;
  };

  const lureShopRows = body.filter((r) => r[0]?.startsWith("LURE_"));

  let prevAD = Math.max(midAD("LURE_0"), startingAD);
  let attackBought = 0;
  let defenseBought = 0;

  return lureShopRows.map((lureRow) => {
    const lureId = lureRow[0];
    const lurePrice = Number(lureRow[1]);
    const lureNum = parseInt(lureId.split("_")[1]);
    const prevLureId = lureNum === 1 ? "LURE_0" : `LURE_${lureNum - 1}`;
    const avg = avgPrice(prevLureId);
    const fishNeeded = avg > 0 ? Math.ceil(lurePrice / avg) : 0;

    const targetAD = midAD(lureId);
    const statGain = Math.max(0, targetAD - prevAD);
    const attackLevels = attackVPL > 0 ? Math.ceil(statGain / attackVPL) : 0;
    const defenseLevels = defenseVPL > 0 ? Math.ceil(statGain / defenseVPL) : 0;
    const adUpgradeCost =
      sumSlice(attackPrices, attackBought, attackLevels) +
      sumSlice(defensePrices, defenseBought, defenseLevels);

    attackBought += attackLevels;
    defenseBought += defenseLevels;
    prevAD = targetAD;

    const currentAvg = avgPrice(lureId);
    const adFishNeeded =
      currentAvg > 0 ? Math.ceil(adUpgradeCost / currentAvg) : 0;
    const totalFishNeeded =
      avg > 0 ? Math.ceil((lurePrice + adUpgradeCost) / avg) : 0;
    return {
      lureId,
      lurePrice,
      fishNeeded,
      adUpgradeCost,
      adFishNeeded,
      totalFishNeeded,
    };
  });
}

function LureCostTable({
  fishRows,
  shopRows,
  startingAD,
}: {
  fishRows: string[][];
  shopRows: string[][];
  startingAD: number;
}) {
  const data = computeLureCostTable(fishRows, shopRows, startingAD);
  if (data.length === 0) return null;
  return (
    <Flex direction="column" gap="2">
      <Text size="2" weight="bold">
        Fish needed to buy next lure
      </Text>
      <Table.Root variant="surface" size="1">
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeaderCell>Lure</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Lure Cost</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Fish (Lure Only)</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>A/D Upgrade Cost</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Fish (A/D Only)</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Total Fish</Table.ColumnHeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {data.map(
            ({
              lureId,
              lurePrice,
              fishNeeded,
              adUpgradeCost,
              adFishNeeded,
              totalFishNeeded,
            }) => (
              <Table.Row key={lureId}>
                <Table.Cell>{lureId}</Table.Cell>
                <Table.Cell>{lurePrice}</Table.Cell>
                <Table.Cell>{fishNeeded}</Table.Cell>
                <Table.Cell>{adUpgradeCost}</Table.Cell>
                <Table.Cell>{adFishNeeded}</Table.Cell>
                <Table.Cell>{totalFishNeeded}</Table.Cell>
              </Table.Row>
            ),
          )}
        </Table.Body>
      </Table.Root>
    </Flex>
  );
}

function PreviewTable({ rows }: { rows: string[][] }) {
  if (rows.length < 2) return null;
  const [header, ...body] = rows;
  return (
    <Table.Root variant="surface" size="1">
      <Table.Header>
        <Table.Row>
          {header.map((h) => (
            <Table.ColumnHeaderCell key={h}>{h}</Table.ColumnHeaderCell>
          ))}
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {body.map((row, i) => (
          <Table.Row key={i}>
            {row.map((cell, j) => (
              <Table.Cell key={j}>{cell}</Table.Cell>
            ))}
          </Table.Row>
        ))}
      </Table.Body>
    </Table.Root>
  );
}

const FISH_DEFAULTS = {
  attackFn: DEFAULT_ATTACK_FN,
  defenseFn: DEFAULT_DEFENSE_FN,
  priceFn: DEFAULT_PRICE_FN,
  baitAttackFn: DEFAULT_BAIT_ATTACK_FN,
  baitDefenseFn: DEFAULT_BAIT_DEFENSE_FN,
  baitPriceFn: DEFAULT_BAIT_PRICE_FN,
  variance: 0.1,
};

function FishGenerator({
  onChange,
  showPreview,
  levels,
}: {
  onChange?: (rows: string[][]) => void;
  showPreview: boolean;
  levels: number;
}) {
  const stored = loadStored(FISH_STORAGE_KEY, FISH_DEFAULTS);
  const [attackFn, setAttackFn] = useState<FunctionConfig>(
    () => stored.attackFn,
  );
  const [defenseFn, setDefenseFn] = useState<FunctionConfig>(
    () => stored.defenseFn,
  );
  const [priceFn, setPriceFn] = useState<FunctionConfig>(() => stored.priceFn);
  const [variance, setVariance] = useState(() => stored.variance);
  const [baitAttackFn, setBaitAttackFn] = useState<FunctionConfig>(
    () => stored.baitAttackFn ?? DEFAULT_BAIT_ATTACK_FN,
  );
  const [baitDefenseFn, setBaitDefenseFn] = useState<FunctionConfig>(
    () => stored.baitDefenseFn ?? DEFAULT_BAIT_DEFENSE_FN,
  );
  const [baitPriceFn, setBaitPriceFn] = useState<FunctionConfig>(
    () => stored.baitPriceFn ?? DEFAULT_BAIT_PRICE_FN,
  );

  const rows = generateFishRows(
    attackFn,
    defenseFn,
    priceFn,
    baitAttackFn,
    baitDefenseFn,
    baitPriceFn,
    variance,
    levels,
  );

  useEffect(() => {
    localStorage.setItem(
      FISH_STORAGE_KEY,
      JSON.stringify({
        attackFn,
        defenseFn,
        priceFn,
        variance,
        baitAttackFn,
        baitDefenseFn,
        baitPriceFn,
      }),
    );
    onChange?.(rows);
    // onChange is a stable useState setter — safe to omit from deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    attackFn,
    defenseFn,
    priceFn,
    variance,
    levels,
    baitAttackFn,
    baitDefenseFn,
    baitPriceFn,
  ]);

  function reset() {
    setAttackFn(FISH_DEFAULTS.attackFn);
    setDefenseFn(FISH_DEFAULTS.defenseFn);
    setPriceFn(FISH_DEFAULTS.priceFn);
    setVariance(FISH_DEFAULTS.variance);
    setBaitAttackFn(FISH_DEFAULTS.baitAttackFn);
    setBaitDefenseFn(FISH_DEFAULTS.baitDefenseFn);
    setBaitPriceFn(FISH_DEFAULTS.baitPriceFn);
  }

  return (
    <Flex direction="column" gap="3">
      <Flex align="center" gap="3">
        <Text size="2" weight="bold">
          Fish
        </Text>
        <Button size="1" variant="ghost" color="gray" onClick={reset}>
          Reset to defaults
        </Button>
      </Flex>

      <Grid columns="2" gap="4">
        <Flex direction="column" gap="2">
          <Text size="1" weight="bold">
            BAIT FISH
          </Text>
          <FunctionSelect
            label="ATK curve"
            value={baitAttackFn}
            onChange={setBaitAttackFn}
          />
          <FunctionSelect
            label="DEF curve"
            value={baitDefenseFn}
            onChange={setBaitDefenseFn}
          />
          <FunctionSelect
            label="Base Price curve"
            value={baitPriceFn}
            onChange={setBaitPriceFn}
          />
        </Flex>

        <Flex direction="column" gap="2">
          <Text size="1" weight="bold">
            LURE FISH
          </Text>
          <FunctionSelect
            label="ATK curve"
            value={attackFn}
            onChange={setAttackFn}
          />
          <FunctionSelect
            label="DEF curve"
            value={defenseFn}
            onChange={setDefenseFn}
          />
          <FunctionSelect
            label="Base Price curve"
            value={priceFn}
            onChange={setPriceFn}
          />
        </Flex>
      </Grid>

      <Flex gap="3" wrap="wrap" align="end">
        <NumInput
          label="Variance"
          value={variance}
          onChange={setVariance}
          min={0}
          max={1}
          step={0.01}
        />
      </Flex>

      {showPreview && (
        <Grid columns="2" gap="4">
          <Flex direction="column" gap="1">
            <Text size="1" color="gray">
              Bait fish
            </Text>
            <PreviewTable
              rows={[
                ["ID", "ATK", "DEF", "BasePrice"],
                ...rows
                  .slice(1)
                  .filter((r) => r[5]?.startsWith("BAIT_"))
                  .filter((_, i) => i % 2 === 0)
                  .map((r) => [r[0], r[1], r[2], r[4]]),
              ]}
            />
          </Flex>
          <Flex direction="column" gap="1">
            <Text size="1" color="gray">
              Lure fish
            </Text>
            <PreviewTable
              rows={[
                ["ID", "ATK", "DEF", "BasePrice"],
                ...rows
                  .slice(1)
                  .filter((r) => r[5]?.startsWith("LURE_"))
                  .filter((_, i) => i % 2 === 0)
                  .map((r) => [r[0], r[1], r[2], r[4]]),
              ]}
            />
          </Flex>
        </Grid>
      )}
      <Button
        size="1"
        variant="soft"
        style={{ width: "fit-content" }}
        onClick={() => {
          const comment = [
            `# Attack curve: ${fnConfigStr(attackFn)}`,
            `# Defense curve: ${fnConfigStr(defenseFn)}`,
            `# Base Price curve: ${fnConfigStr(priceFn)}`,
            `# Variance: ${variance} | Levels: ${levels}`,
          ].join("\n");
          downloadCsv(rows, "FishGameplay.csv", comment);
        }}
      >
        Download FishGameplay.csv
      </Button>
    </Flex>
  );
}

const SHOP_DEFAULTS = {
  attackFn: DEFAULT_STAT_FN,
  attackVPL: 1,
  attackCount: 10,
  defenseFn: DEFAULT_STAT_FN,
  defenseVPL: 1,
  defenseCount: 10,
  lureFn: DEFAULT_LURE_FN,
  baitFn: DEFAULT_BAIT_FN,
  baitCount: 1,
  rodCount: 1,
  rodPurchaseFn: DEFAULT_ROD_PURCHASE_FN,
  rodHolderLevels: 3,
  rodHolderFn: DEFAULT_ROD_HOLDER_FN,
};

function ShopGenerator({
  onChange,
  showPreview,
  lureCount,
}: {
  onChange?: (rows: string[][]) => void;
  showPreview: boolean;
  lureCount: number;
}) {
  const stored = loadStored(SHOP_STORAGE_KEY, SHOP_DEFAULTS);
  const [attackFn, setAttackFn] = useState<FunctionConfig>(
    () => stored.attackFn,
  );
  const [attackVPL, setAttackVPL] = useState(() => stored.attackVPL);
  const [attackCount, setAttackCount] = useState(() => stored.attackCount);

  const [defenseFn, setDefenseFn] = useState<FunctionConfig>(
    () => stored.defenseFn,
  );
  const [defenseVPL, setDefenseVPL] = useState(() => stored.defenseVPL);
  const [defenseCount, setDefenseCount] = useState(() => stored.defenseCount);

  const [lureFn, setLureFn] = useState<FunctionConfig>(() => stored.lureFn);
  const [baitFn, setBaitFn] = useState<FunctionConfig>(
    () => stored.baitFn ?? DEFAULT_BAIT_FN,
  );
  const [baitCount, setBaitCount] = useState(() => stored.baitCount ?? 1);
  const [rodCount, setRodCount] = useState(() => stored.rodCount ?? 1);
  const [rodPurchaseFn, setRodPurchaseFn] = useState<FunctionConfig>(
    () => stored.rodPurchaseFn ?? DEFAULT_ROD_PURCHASE_FN,
  );
  const [rodHolderLevels, setRodHolderLevels] = useState(
    () => stored.rodHolderLevels ?? 3,
  );
  const [rodHolderFn, setRodHolderFn] = useState<FunctionConfig>(
    () => stored.rodHolderFn ?? DEFAULT_ROD_HOLDER_FN,
  );

  const rows = generateShopRows(
    attackFn,
    attackVPL,
    attackCount,
    defenseFn,
    defenseVPL,
    defenseCount,
    lureFn,
    lureCount,
    baitFn,
    baitCount,
    rodCount,
    rodPurchaseFn,
    rodHolderFn,
    rodHolderLevels,
  );

  useEffect(() => {
    localStorage.setItem(
      SHOP_STORAGE_KEY,
      JSON.stringify({
        attackFn,
        attackVPL,
        attackCount,
        defenseFn,
        defenseVPL,
        defenseCount,
        lureFn,
        baitFn,
        baitCount,
        rodCount,
        rodPurchaseFn,
        rodHolderLevels,
        rodHolderFn,
      }),
    );
    onChange?.(rows);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    attackFn,
    attackVPL,
    attackCount,
    defenseFn,
    defenseVPL,
    defenseCount,
    lureFn,
    lureCount,
    baitFn,
    baitCount,
    rodCount,
    rodPurchaseFn,
    rodHolderLevels,
    rodHolderFn,
  ]);

  function reset() {
    setAttackFn(SHOP_DEFAULTS.attackFn);
    setAttackVPL(SHOP_DEFAULTS.attackVPL);
    setAttackCount(SHOP_DEFAULTS.attackCount);
    setDefenseFn(SHOP_DEFAULTS.defenseFn);
    setDefenseVPL(SHOP_DEFAULTS.defenseVPL);
    setDefenseCount(SHOP_DEFAULTS.defenseCount);
    setLureFn(SHOP_DEFAULTS.lureFn);
    setBaitFn(SHOP_DEFAULTS.baitFn);
    setBaitCount(SHOP_DEFAULTS.baitCount);
    setRodCount(SHOP_DEFAULTS.rodCount);
    setRodPurchaseFn(SHOP_DEFAULTS.rodPurchaseFn);
    setRodHolderLevels(SHOP_DEFAULTS.rodHolderLevels);
    setRodHolderFn(SHOP_DEFAULTS.rodHolderFn);
  }

  return (
    <Flex direction="column" gap="3">
      <Flex align="center" gap="3">
        <Text size="2" weight="bold">
          Shop
        </Text>
        <Button size="1" variant="ghost" color="gray" onClick={reset}>
          Reset to defaults
        </Button>
      </Flex>

      <Grid columns="2" gap="4">
        <Flex direction="column" gap="2">
          <Text size="1" weight="bold">
            ATTACK
          </Text>
          <FunctionSelect
            label="Price curve"
            value={attackFn}
            onChange={setAttackFn}
          />
          <Flex gap="3" wrap="wrap" align="end">
            <NumInput
              label="ValuePerLevel"
              value={attackVPL}
              onChange={setAttackVPL}
              min={1}
            />
            <NumInput
              label="Upgrades"
              value={attackCount}
              onChange={setAttackCount}
              min={1}
            />
          </Flex>
        </Flex>

        <Flex direction="column" gap="2">
          <Text size="1" weight="bold">
            DEFENSE
          </Text>
          <FunctionSelect
            label="Price curve"
            value={defenseFn}
            onChange={setDefenseFn}
          />
          <Flex gap="3" wrap="wrap" align="end">
            <NumInput
              label="ValuePerLevel"
              value={defenseVPL}
              onChange={setDefenseVPL}
              min={1}
            />
            <NumInput
              label="Upgrades"
              value={defenseCount}
              onChange={setDefenseCount}
              min={1}
            />
          </Flex>
        </Flex>

        <Flex direction="column" gap="2">
          <Text size="1" weight="bold">
            LURE
          </Text>
          <FunctionSelect
            label="Price curve"
            value={lureFn}
            onChange={setLureFn}
          />
        </Flex>

        <Flex direction="column" gap="2">
          <Text size="1" weight="bold">
            RODS
          </Text>
          <Flex gap="3" wrap="wrap" align="end">
            <NumInput
              label="Rod count"
              value={rodCount}
              onChange={setRodCount}
              min={1}
            />
          </Flex>
          {rodCount > 1 && (
            <FunctionSelect
              label="Rod purchase price curve (ROD_2+)"
              value={rodPurchaseFn}
              onChange={setRodPurchaseFn}
            />
          )}
        </Flex>

        <Flex direction="column" gap="2">
          <Text size="1" weight="bold">
            ROD HOLDER
          </Text>
          <Flex gap="3" wrap="wrap" align="end">
            <NumInput
              label="Levels"
              value={rodHolderLevels}
              onChange={setRodHolderLevels}
              min={0}
            />
          </Flex>
          {rodHolderLevels > 0 && (
            <FunctionSelect
              label="Price curve"
              value={rodHolderFn}
              onChange={setRodHolderFn}
            />
          )}
        </Flex>

        <Flex direction="column" gap="2">
          <Text size="1" weight="bold">
            BAIT
          </Text>
          <FunctionSelect
            label="Price curve"
            value={baitFn}
            onChange={setBaitFn}
          />
          <Flex gap="3" wrap="wrap" align="end">
            <NumInput
              label="Bait tiers"
              value={baitCount}
              onChange={setBaitCount}
              min={1}
            />
          </Flex>
        </Flex>
      </Grid>

      {showPreview && (
        <PreviewTable
          rows={[["ID", "Price"], ...rows.slice(1).map((r) => [r[0], r[1]])]}
        />
      )}
      <Button
        size="1"
        variant="soft"
        style={{ width: "fit-content" }}
        onClick={() => {
          const comment = [
            `# ROD_ATTACK price curve: ${fnConfigStr(attackFn)} | ValuePerLevel=${attackVPL} | Upgrades=${attackCount}`,
            `# ROD_DEFENSE price curve: ${fnConfigStr(defenseFn)} | ValuePerLevel=${defenseVPL} | Upgrades=${defenseCount}`,
            `# LURE price curve: ${fnConfigStr(lureFn)} | Lures=${lureCount}`,
            `# BAIT price curve: ${fnConfigStr(baitFn)} | Tiers=${baitCount}`,
            `# ROD_HOLDER price curve: ${fnConfigStr(rodHolderFn)} | Levels=${rodHolderLevels}`,
          ].join("\n");
          downloadCsv(rows, "ShopGameplay.csv", comment);
        }}
      >
        Download ShopGameplay.csv
      </Button>
    </Flex>
  );
}

export function getGeneratedFishRows(): string[][] {
  const { levels } = loadStored(SHARED_STORAGE_KEY, {
    levels: 3,
    startingAD: 10,
  });
  const {
    attackFn,
    defenseFn,
    priceFn,
    variance,
    baitAttackFn,
    baitDefenseFn,
    baitPriceFn,
  } = loadStored(FISH_STORAGE_KEY, FISH_DEFAULTS);
  return generateFishRows(
    attackFn,
    defenseFn,
    priceFn,
    baitAttackFn ?? DEFAULT_BAIT_ATTACK_FN,
    baitDefenseFn ?? DEFAULT_BAIT_DEFENSE_FN,
    baitPriceFn ?? DEFAULT_BAIT_PRICE_FN,
    variance,
    levels,
  );
}

export function getGeneratedShopRows(): string[][] {
  const { levels } = loadStored(SHARED_STORAGE_KEY, {
    levels: 3,
    startingAD: 10,
  });
  const {
    attackFn,
    attackVPL,
    attackCount,
    defenseFn,
    defenseVPL,
    defenseCount,
    lureFn,
    baitFn,
    baitCount,
    rodCount,
    rodPurchaseFn,
    rodHolderLevels,
    rodHolderFn,
  } = loadStored(SHOP_STORAGE_KEY, SHOP_DEFAULTS);
  return generateShopRows(
    attackFn,
    attackVPL,
    attackCount,
    defenseFn,
    defenseVPL,
    defenseCount,
    lureFn,
    levels,
    baitFn,
    baitCount,
    rodCount,
    rodPurchaseFn,
    rodHolderFn ?? DEFAULT_ROD_HOLDER_FN,
    rodHolderLevels ?? 3,
  );
}

export function CsvGeneratorPanel({
  onFishRowsChange,
  onShopRowsChange,
  onOpenChange,
}: {
  onFishRowsChange?: (rows: string[][]) => void;
  onShopRowsChange?: (rows: string[][]) => void;
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(true);
  const [showPreview, setShowPreview] = useState(true);
  const [fishRows, setFishRows] = useState<string[][]>([]);
  const [shopRows, setShopRows] = useState<string[][]>([]);
  const [levels, setLevels] = useState<number>(
    () => loadStored(SHARED_STORAGE_KEY, { levels: 3, startingAD: 10 }).levels,
  );
  const [startingAD, setStartingAD] = useState<number>(
    () =>
      loadStored(SHARED_STORAGE_KEY, { levels: 3, startingAD: 25 }).startingAD,
  );

  function handleLevelsChange(v: number) {
    setLevels(v);
    localStorage.setItem(
      SHARED_STORAGE_KEY,
      JSON.stringify({ levels: v, startingAD }),
    );
  }

  function handleStartingADChange(v: number) {
    setStartingAD(v);
    localStorage.setItem(
      SHARED_STORAGE_KEY,
      JSON.stringify({ levels, startingAD: v }),
    );
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    onOpenChange?.(next);
  }

  return (
    <Flex direction="column" gap="3">
      <Flex align="center" gap="4">
        <button
          onClick={toggle}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
          }}
        >
          <Text size="1" color="gray">
            {open ? "▾" : "▸"} Generate CSVs
          </Text>
        </button>
        {open && (
          <>
            <NumInput
              label="Levels"
              value={levels}
              onChange={handleLevelsChange}
              min={1}
            />
            <NumInput
              label="Starting A/D"
              value={startingAD}
              onChange={handleStartingADChange}
              min={0}
            />
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={showPreview}
                onChange={(e) => setShowPreview(e.target.checked)}
              />
              <Text size="1" color="gray">
                Show preview
              </Text>
            </label>
          </>
        )}
      </Flex>
      {open && (
        <>
          <Flex direction="row" gap="6" align="start">
            <Flex direction="column" gap="3" style={{ flex: 1 }}>
              <FishGenerator
                onChange={(rows) => {
                  setFishRows(rows);
                  onFishRowsChange?.(rows);
                }}
                showPreview={showPreview}
                levels={levels}
              />
            </Flex>
            <Separator orientation="vertical" size="4" />
            <Flex direction="column" gap="3" style={{ flex: 1 }}>
              <ShopGenerator
                onChange={(rows) => {
                  setShopRows(rows);
                  onShopRowsChange?.(rows);
                }}
                showPreview={showPreview}
                lureCount={levels}
              />
            </Flex>
          </Flex>
          {showPreview && (
            <LureCostTable
              fishRows={fishRows}
              shopRows={shopRows}
              startingAD={startingAD}
            />
          )}
        </>
      )}
    </Flex>
  );
}
