import React, { useEffect, useRef, useState } from "react";
import { Flex, Grid, Text, Table, Button, Separator } from "@radix-ui/themes";
import { NumInput } from "./shared";
import {
  levelStat,
  loadRodData,
  loadLocationGameplayData,
  type RodData,
} from "../../util/csvLoader";
import {
  INITIAL_PLAYER_STATE,
  rarityExpectedPriceMultiplier,
} from "../../util/constants";
import shopTemplateJson from "../../data/shopTemplate.json";

export const GENERATED_FISH_CSV = "__generated_fish__";
export const GENERATED_SHOP_CSV = "__generated_shop__";

const FISH_STORAGE_KEY = "csvgen_fish";
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
    0,
    levels - 1,
    (l) => `LURE_${l}`,
    (i) => `FISH_${i}`,
    "35",
  );
  return [...header, ...baitRows, ...lureRows];
}

// LocationGameplay's PERCENT is the relative chance each fish in the pool
// is the one that appears, so it must be renormalized within the pool
// rather than treated as an absolute probability. Rarity's price
// multiplier is then blended in on top of that.
function expectedPoolPrice(
  fish: { id: string; price: number }[],
  locationPercents: Map<string, number>,
): number {
  if (fish.length === 0) return 0;
  const totalPercent = fish.reduce(
    (s, f) => s + (locationPercents.get(f.id) ?? 1),
    0,
  );
  return fish.reduce((s, f) => {
    const weight = (locationPercents.get(f.id) ?? 1) / totalPercent;
    return s + weight * f.price * rarityExpectedPriceMultiplier(f.id);
  }, 0);
}

function aggregateByTackle(
  rows: string[][],
  prefix: string,
  locationPercents: Map<string, number>,
): string[][] {
  const groups = new Map<
    string,
    { id: string; atk: number; def: number; price: number }[]
  >();
  for (const r of rows) {
    const tackleId = r[5];
    if (!tackleId?.startsWith(prefix)) continue;
    if (!groups.has(tackleId)) groups.set(tackleId, []);
    groups.get(tackleId)!.push({
      id: r[0],
      atk: Number(r[1]),
      def: Number(r[2]),
      price: Number(r[4]),
    });
  }
  return Array.from(groups.entries()).map(([id, fish]) => [
    id.slice(prefix.length),
    String(Math.min(...fish.map((f) => f.atk))),
    String(Math.min(...fish.map((f) => f.def))),
    String(Math.ceil(fish.reduce((s, f) => s + f.price, 0) / fish.length)),
    String(Math.ceil(expectedPoolPrice(fish, locationPercents))),
  ]);
}

function priceList(fn: FunctionConfig, count: number, mult = 1): string {
  const scaledFn = { ...fn, startValue: fn.startValue * mult };
  return Array.from({ length: count }, (_, i) =>
    Math.ceil(evalFn(scaledFn, i)),
  ).join(" ");
}

// ── Shop template ──────────────────────────────────────────────────────────
// The shop generator is driven by src/data/shopTemplate.json: each shop lists
// its items and their default price curves, and the UI/rows are built from
// that. Adding a shop item means adding a template entry, not touching this
// file.

interface CurveTemplate {
  type: FnType;
  startValue: number;
  scaleFactor?: number;
  growthRate?: number;
}

interface ShopTemplateItem {
  // Card title in the generator UI.
  label: string;
  // Row ID. May contain {rod} (perRod items) and {i} (series items).
  id: string;
  stat: string;
  // "levels": one row whose price list has `count` levels.
  // "series": `count` rows ({i} = 0…count−1), each priced at curve(i).
  kind: "levels" | "series";
  // "levels" means the shared Levels setting (one lure per fish tier).
  count: number | "levels";
  valuePerLevel?: number;
  // Show a ValuePerLevel input for this item.
  editValue?: boolean;
  // Repeat for ROD_1…ROD_n; start price scales by priceMultiplier^(rod−1),
  // and rows for rod 2+ require ROD_{rod}.
  perRod?: boolean;
  // Series only: row i requires row i−n.
  requiresPrevious?: number;
  curve: CurveTemplate;
}

interface ShopTemplate {
  title: string;
  output: string;
  // Rods are the one built-in concept: count/multiplier drive perRod items,
  // and ROD_n purchase rows (n ≥ 2) are priced at purchaseCurve(n−2).
  rods?: {
    count: number;
    priceMultiplier: number;
    purchaseCurve: CurveTemplate;
  };
  items: ShopTemplateItem[];
}

export type ShopKey = keyof typeof shopTemplateJson;
const SHOP_TEMPLATES = shopTemplateJson as Record<ShopKey, ShopTemplate>;

interface ItemSettings {
  curve: FunctionConfig;
  count: number;
  valuePerLevel: number;
}

interface RodSettings {
  count: number;
  priceMultiplier: number;
  purchaseCurve: FunctionConfig;
}

interface ShopSettings {
  rods: RodSettings;
  // Keyed by template item id.
  items: Record<string, ItemSettings>;
}

function curveFromTemplate(c: CurveTemplate): FunctionConfig {
  return {
    type: c.type,
    startValue: c.startValue,
    scaleFactor: c.scaleFactor ?? 4,
    growthRate: c.growthRate ?? 0.8,
  };
}

function templateSettings(template: ShopTemplate): ShopSettings {
  const rods = template.rods;
  return {
    rods: {
      count: rods?.count ?? 1,
      priceMultiplier: rods?.priceMultiplier ?? 1,
      purchaseCurve: curveFromTemplate(
        rods?.purchaseCurve ?? { type: "LINEAR", startValue: 0 },
      ),
    },
    items: Object.fromEntries(
      template.items.map((item) => [
        item.id,
        {
          curve: curveFromTemplate(item.curve),
          count: typeof item.count === "number" ? item.count : 0,
          valuePerLevel: item.valuePerLevel ?? 1,
        },
      ]),
    ),
  };
}

function substituteId(id: string, vars: Record<string, number>): string {
  return id.replace(/\{(\w+)\}/g, (match, key) =>
    key in vars ? String(vars[key]) : match,
  );
}

function templateItemRows(
  item: ShopTemplateItem,
  settings: ItemSettings,
  levels: number,
  vars: Record<string, number>,
  priceMult: number,
  rodRequirement: string,
): string[][] {
  const count = item.count === "levels" ? levels : settings.count;
  const vpl = String(settings.valuePerLevel);
  if (item.kind === "levels") {
    if (count <= 0) return [];
    return [
      [
        substituteId(item.id, vars),
        priceList(settings.curve, count, priceMult),
        item.stat,
        vpl,
        rodRequirement,
      ],
    ];
  }
  const curve = {
    ...settings.curve,
    startValue: settings.curve.startValue * priceMult,
  };
  const gap = item.requiresPrevious ?? 0;
  return Array.from({ length: count }, (_, i) => {
    const previous =
      gap > 0 && i >= gap ? substituteId(item.id, { ...vars, i: i - gap }) : "";
    return [
      substituteId(item.id, { ...vars, i }),
      String(Math.ceil(evalFn(curve, i))),
      item.stat,
      vpl,
      [rodRequirement, previous].filter(Boolean).join(" "),
    ];
  });
}

// Rows come out per rod (its purchase row, then its perRod items in template
// order), followed by the remaining items in template order.
function generateRowsFromTemplate(
  template: ShopTemplate,
  settings: ShopSettings,
  levels: number,
): string[][] {
  const rows: string[][] = [
    ["ID", "Price", "Stat", "ValuePerLevel", "Requirement"],
  ];
  const itemSettings = (item: ShopTemplateItem) =>
    settings.items[item.id] ?? templateSettings(template).items[item.id];
  const rodItems = template.items.filter((item) => item.perRod);
  const otherItems = template.items.filter((item) => !item.perRod);

  const { rods } = settings;
  const rodCount = rodItems.length > 0 || template.rods ? rods.count : 0;
  for (let r = 1; r <= rodCount; r++) {
    const rodId = `ROD_${r}`;
    if (r > 1) {
      rows.push([
        rodId,
        String(Math.ceil(evalFn(rods.purchaseCurve, r - 2))),
        "ROD",
        "1",
        `ROD_${r - 1}`,
      ]);
    }
    const priceMult = Math.pow(rods.priceMultiplier, r - 1);
    for (const item of rodItems) {
      rows.push(
        ...templateItemRows(
          item,
          itemSettings(item),
          levels,
          { rod: r },
          priceMult,
          r > 1 ? rodId : "",
        ),
      );
    }
  }

  for (const item of otherItems) {
    rows.push(...templateItemRows(item, itemSettings(item), levels, {}, 1, ""));
  }

  return rows;
}

function shopStorageKey(shopKey: ShopKey): string {
  return `csvgen_${shopKey}_v2`;
}

// One-time carry-over of settings saved by the pre-template generator, so
// existing tuning survives the switch. Safe to delete once nobody has the old
// csvgen_shop key around.
function legacyShopSettings(shopKey: ShopKey): Partial<ShopSettings> | null {
  try {
    if (shopKey === "shop") {
      const raw = localStorage.getItem("csvgen_shop");
      if (!raw) return null;
      const old = JSON.parse(raw);
      const items: Record<string, Partial<ItemSettings>> = {
        "ROD_{rod}_ATTACK": { curve: old.attackFn, count: old.attackCount },
        "ROD_{rod}_DEFENSE": { curve: old.defenseFn, count: old.defenseCount },
        "ROD_{rod}_LINE_HP": { curve: old.lineHpFn, count: old.lineHpCount },
        "LURE_{i}": { curve: old.lureFn },
        "BAIT_{i}": { curve: old.baitFn, count: old.baitCount },
      };
      return {
        rods: {
          count: old.rodCount,
          priceMultiplier: old.rodPriceMultiplier,
          purchaseCurve: old.rodPurchaseFn,
        },
        items: items as Record<string, ItemSettings>,
      };
    }
  } catch {}
  return null;
}

function withoutUndefined<T extends object>(obj: T | undefined): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj ?? {}).filter(([, v]) => v !== undefined),
  ) as Partial<T>;
}

// Saved settings layered over the template's defaults. Items missing from the
// saved settings (e.g. newly added to the template) get their defaults.
function loadShopSettings(shopKey: ShopKey): ShopSettings {
  const defaults = templateSettings(SHOP_TEMPLATES[shopKey]);
  let saved: Partial<ShopSettings> | null = null;
  try {
    const raw = localStorage.getItem(shopStorageKey(shopKey));
    if (raw) saved = JSON.parse(raw);
  } catch {}
  saved ??= legacyShopSettings(shopKey);
  if (!saved) return defaults;
  return {
    rods: { ...defaults.rods, ...withoutUndefined(saved.rods) },
    items: Object.fromEntries(
      Object.entries(defaults.items).map(([id, d]) => [
        id,
        { ...d, ...withoutUndefined(saved.items?.[id]) },
      ]),
    ),
  };
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
  rodData: RodData[],
  locationPercents: Map<string, number>,
): {
  lureId: string;
  lurePrice: number;
  adRequirement: number;
  fishNeeded: number;
  adUpgradeCost: number;
  adFishNeeded: number;
  totalFishNeeded: number;
}[] {
  if (fishRows.length < 2 || shopRows.length < 2) return [];

  // Group fish by RequiredTackle, preserving insertion order (min, mid, max)
  const poolFish = new Map<
    string,
    { id: string; ad: number; price: number }[]
  >();
  for (const row of fishRows.slice(1)) {
    const requiredTackle = row[5] ?? "";
    const id = row[0];
    const ad = Number(row[1]);
    const price = Number(row[4]);
    if (!poolFish.has(requiredTackle)) poolFish.set(requiredTackle, []);
    poolFish.get(requiredTackle)!.push({ id, ad, price });
  }

  const epPrice = (lureId: string) => {
    const fish = poolFish.get(lureId);
    if (!fish || fish.length === 0) return 0;
    return expectedPoolPrice(fish, locationPercents);
  };

  // Lowest fish A/D in the pool — the stat needed to catch the easiest
  // fish available at that lure tier.
  const minAD = (lureId: string) => {
    const fish = poolFish.get(lureId);
    if (!fish || fish.length === 0) return 0;
    return Math.min(...fish.map((f) => f.ad));
  };

  // Parse ATTACK and DEFENSE shop rows (ROD_1's, since that's the rod the
  // player starts with and the lure-cost projection tracks)
  const body = shopRows.slice(1);
  const attackRow = body.find((r) => r[0] === "ROD_1_ATTACK");
  const defenseRow = body.find((r) => r[0] === "ROD_1_DEFENSE");
  const attackPrices = attackRow ? attackRow[1].split(" ").map(Number) : [];
  const defensePrices = defenseRow ? defenseRow[1].split(" ").map(Number) : [];

  // Buying a level from the shop advances the rod's upgrade index — the
  // actual stat gained per level is whatever RodGameplay.csv's per-level
  // increment says, which is not necessarily the shop's flat ValuePerLevel.
  const rod1 = rodData.find((r) => r.id === "ROD_1");
  const attackPerLevel = rod1?.attackPerLevel ?? 0;
  const defensePerLevel = rod1?.defensePerLevel ?? 0;

  const sumSlice = (prices: number[], from: number, count: number) => {
    let total = 0;
    for (let i = from; i < from + count && i < prices.length; i++)
      total += prices[i];
    return total;
  };

  // How many additional levels are needed for the stat to increase by `gain`.
  const levelsForGain = (perLevel: number, gain: number) => {
    if (gain <= 0 || perLevel <= 0) return 0;
    return Math.ceil(gain / perLevel);
  };

  const lureShopRows = body.filter((r) => r[0]?.startsWith("LURE_"));

  let prevAD = Math.max(minAD("BAIT_0"), startingAD);
  let prevLureId = "BAIT_0";
  let attackBought = 0;
  let defenseBought = 0;

  return lureShopRows.map((lureRow) => {
    const lureId = lureRow[0];
    const lurePrice = Number(lureRow[1]);
    // Both the cost/fish pool pick and the A/D-gap sizing should credit
    // the player with max(Initial Player Stats, Previous Lure
    // Requirements) — a high Starting A/D should keep "counting" until a
    // tier's own requirement finally exceeds it, not just for the first
    // tier. `prevAD` itself stays the raw per-tier requirement chain so it
    // isn't permanently inflated by a one-time comparison.
    const effectiveAD = Math.max(startingAD, prevAD);
    // Fish/A-D costs are funded by whatever's still equipped while saving
    // up — the player doesn't have `lureId` yet — so price against the
    // previous tier's EP, not this row's own.
    const ep = epPrice(prevLureId);

    const fishNeeded = ep > 0 ? Math.ceil(lurePrice / ep) : 0;

    const targetAD = minAD(lureId);
    const statGain = Math.max(0, targetAD - effectiveAD);
    const attackLevels = levelsForGain(attackPerLevel, statGain);
    const defenseLevels = levelsForGain(defensePerLevel, statGain);
    const adUpgradeCost =
      sumSlice(attackPrices, attackBought, attackLevels) +
      sumSlice(defensePrices, defenseBought, defenseLevels);

    attackBought += attackLevels;
    defenseBought += defenseLevels;
    prevAD = targetAD;
    prevLureId = lureId;

    const adFishNeeded = ep > 0 ? Math.ceil(adUpgradeCost / ep) : 0;
    const totalFishNeeded =
      ep > 0 ? Math.ceil((lurePrice + adUpgradeCost) / ep) : 0;
    return {
      lureId,
      lurePrice,
      adRequirement: targetAD,
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
  rodData,
  locationPercents,
}: {
  fishRows: string[][];
  shopRows: string[][];
  startingAD: number;
  rodData: RodData[];
  locationPercents: Map<string, number>;
}) {
  const data = computeLureCostTable(
    fishRows,
    shopRows,
    startingAD,
    rodData,
    locationPercents,
  );
  if (data.length === 0) return null;
  return (
    <Flex direction="column" gap="2" maxWidth={"500px"}>
      <Text size="2" weight="bold">
        Fish needed to buy next lure
      </Text>
      <Table.Root variant="surface" size="1">
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeaderCell>Lure</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>A/D Req</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Lure Cost</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>A/D Cost</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Lure Fish</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>A/D Fish </Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Total Fish</Table.ColumnHeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {data.map(
            ({
              lureId,
              lurePrice,
              adRequirement,
              fishNeeded,
              adUpgradeCost,
              adFishNeeded,
              totalFishNeeded,
            }) => (
              <Table.Row key={lureId}>
                <Table.Cell>{lureId}</Table.Cell>
                <Table.Cell>{adRequirement}</Table.Cell>
                <Table.Cell>{lurePrice}</Table.Cell>
                <Table.Cell>{adUpgradeCost}</Table.Cell>
                <Table.Cell>{fishNeeded}</Table.Cell>
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

const FISH_DEFAULTS: {
  attackFn: FunctionConfig;
  defenseFn: FunctionConfig;
  priceFn: FunctionConfig;
  baitAttackFn: FunctionConfig;
  baitDefenseFn: FunctionConfig;
  baitPriceFn: FunctionConfig;
  variance: number;
} = {
  attackFn: { type: "LINEAR", startValue: 2, scaleFactor: 4, growthRate: 0.8 },
  defenseFn: { type: "LINEAR", startValue: 2, scaleFactor: 4, growthRate: 0.8 },
  priceFn: { type: "LINEAR", startValue: 4, scaleFactor: 4, growthRate: 0.8 },
  baitAttackFn: {
    type: "LINEAR",
    startValue: 2,
    scaleFactor: 4,
    growthRate: 0.8,
  },
  baitDefenseFn: {
    type: "LINEAR",
    startValue: 2,
    scaleFactor: 4,
    growthRate: 0.8,
  },
  baitPriceFn: {
    type: "LINEAR",
    startValue: 4,
    scaleFactor: 4,
    growthRate: 0.8,
  },
  variance: 0.1,
};

function FishGenerator({
  onChange,
  showPreview,
  levels,
  locationPercents,
}: {
  onChange?: (rows: string[][]) => void;
  showPreview: boolean;
  levels: number;
  locationPercents: Map<string, number>;
}) {
  const stored = loadStored(FISH_STORAGE_KEY, FISH_DEFAULTS);
  const initialRef = useRef(stored);
  const [attackFn, setAttackFn] = useState<FunctionConfig>(
    () => stored.attackFn,
  );
  const [defenseFn, setDefenseFn] = useState<FunctionConfig>(
    () => stored.defenseFn,
  );
  const [priceFn, setPriceFn] = useState<FunctionConfig>(() => stored.priceFn);
  const [variance, setVariance] = useState(() => stored.variance);
  const [baitAttackFn, setBaitAttackFn] = useState<FunctionConfig>(
    () => stored.baitAttackFn,
  );
  const [baitDefenseFn, setBaitDefenseFn] = useState<FunctionConfig>(
    () => stored.baitDefenseFn,
  );
  const [baitPriceFn, setBaitPriceFn] = useState<FunctionConfig>(
    () => stored.baitPriceFn,
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

  function undo() {
    setAttackFn(initialRef.current.attackFn);
    setDefenseFn(initialRef.current.defenseFn);
    setPriceFn(initialRef.current.priceFn);
    setVariance(initialRef.current.variance);
    setBaitAttackFn(initialRef.current.baitAttackFn);
    setBaitDefenseFn(initialRef.current.baitDefenseFn);
    setBaitPriceFn(initialRef.current.baitPriceFn);
  }

  return (
    <Flex direction="column" gap="3">
      <Flex align="center" gap="3">
        <Text size="2" weight="bold">
          Fish
        </Text>
        <Button size="1" variant="ghost" color="gray" onClick={undo}>
          Undo
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
                ["ID", "ATK", "DEF", "BP", "EP"],
                ...aggregateByTackle(rows.slice(1), "BAIT_", locationPercents),
              ]}
            />
          </Flex>
          <Flex direction="column" gap="1">
            <Text size="1" color="gray">
              Lure fish
            </Text>
            <PreviewTable
              rows={[
                ["ID", "ATK", "DEF", "BP", "EP"],
                ...aggregateByTackle(rows.slice(1), "LURE_", locationPercents),
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

function TemplateShopGenerator({
  shopKey,
  levels,
  onChange,
  showPreview,
}: {
  shopKey: ShopKey;
  levels: number;
  onChange?: (rows: string[][]) => void;
  showPreview: boolean;
}) {
  const template = SHOP_TEMPLATES[shopKey];
  const [settings, setSettings] = useState<ShopSettings>(() =>
    loadShopSettings(shopKey),
  );
  const initialRef = useRef(settings);

  const rows = generateRowsFromTemplate(template, settings, levels);

  useEffect(() => {
    localStorage.setItem(shopStorageKey(shopKey), JSON.stringify(settings));
    onChange?.(rows);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, levels]);

  function setRods(patch: Partial<RodSettings>) {
    setSettings((s) => ({ ...s, rods: { ...s.rods, ...patch } }));
  }

  function setItem(id: string, patch: Partial<ItemSettings>) {
    setSettings((s) => ({
      ...s,
      items: { ...s.items, [id]: { ...s.items[id], ...patch } },
    }));
  }

  function downloadComment(): string {
    const lines = template.items.map((item) => {
      const { curve, count, valuePerLevel } = settings.items[item.id];
      const countStr =
        item.count === "levels" ? `count=${levels} (levels)` : `count=${count}`;
      const vplStr = item.editValue ? ` | valuePerLevel=${valuePerLevel}` : "";
      return `# ${item.id} price curve: ${fnConfigStr(curve)} | ${countStr}${vplStr}`;
    });
    if (template.rods) {
      const { count, priceMultiplier, purchaseCurve } = settings.rods;
      lines.push(
        `# Rods: count=${count} | priceMultiplier=${priceMultiplier} | purchase curve: ${fnConfigStr(purchaseCurve)}`,
      );
    }
    return lines.join("\n");
  }

  return (
    <Flex direction="column" gap="3">
      <Flex align="center" gap="3">
        <Text size="2" weight="bold">
          {template.title}
        </Text>
        <Button
          size="1"
          variant="ghost"
          color="gray"
          onClick={() => setSettings(initialRef.current)}
        >
          Undo
        </Button>
        <Button
          size="1"
          variant="ghost"
          color="gray"
          onClick={() => setSettings(templateSettings(template))}
        >
          Reset to template
        </Button>
      </Flex>

      <Grid columns="2" gap="4">
        {template.items.map((item) => {
          const itemSettings = settings.items[item.id];
          return (
            <Flex key={item.id} direction="column" gap="2">
              <Text size="1" weight="bold">
                {item.label}
              </Text>
              <FunctionSelect
                label="Price curve"
                value={itemSettings.curve}
                onChange={(curve) => setItem(item.id, { curve })}
              />
              {(item.count !== "levels" || item.editValue) && (
                <Flex gap="3" wrap="wrap" align="end">
                  {item.count !== "levels" && (
                    <NumInput
                      label={item.kind === "series" ? "Tiers" : "Upgrades"}
                      value={itemSettings.count}
                      onChange={(count) => setItem(item.id, { count })}
                      min={0}
                    />
                  )}
                  {item.editValue && (
                    <NumInput
                      label="Value per level"
                      value={itemSettings.valuePerLevel}
                      onChange={(valuePerLevel) =>
                        setItem(item.id, { valuePerLevel })
                      }
                      min={-99999}
                      max={99999}
                    />
                  )}
                </Flex>
              )}
            </Flex>
          );
        })}

        {template.rods && (
          <Flex direction="column" gap="2">
            <Text size="1" weight="bold">
              RODS
            </Text>
            <Flex gap="3" wrap="wrap" align="end">
              <NumInput
                label="Rod count"
                value={settings.rods.count}
                onChange={(count) => setRods({ count })}
                min={1}
              />
              <NumInput
                label="Price multiplier"
                value={settings.rods.priceMultiplier}
                onChange={(priceMultiplier) => setRods({ priceMultiplier })}
                min={0.1}
                step={0.1}
              />
            </Flex>
            {settings.rods.count > 1 && (
              <FunctionSelect
                label="Rod purchase price curve (ROD_2+)"
                value={settings.rods.purchaseCurve}
                onChange={(purchaseCurve) => setRods({ purchaseCurve })}
              />
            )}
          </Flex>
        )}
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
        onClick={() => downloadCsv(rows, template.output, downloadComment())}
      >
        Download {template.output}
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
    baitAttackFn,
    baitDefenseFn,
    baitPriceFn,
    variance,
    levels,
  );
}

export function getGeneratedShopRows(): string[][] {
  const { levels } = loadStored(SHARED_STORAGE_KEY, {
    levels: 3,
    startingAD: 10,
  });
  return generateRowsFromTemplate(
    SHOP_TEMPLATES.shop,
    loadShopSettings("shop"),
    levels,
  );
}

// The real starting A/D a fresh player has (ROD_1 at level 0), so the
// "Starting A/D" input defaults to something grounded in the actual game
// rather than an arbitrary guess.
function initialPlayerAD(rodData: RodData[]): number {
  const initialRod = INITIAL_PLAYER_STATE.ownedRods[0];
  const data = rodData.find((r) => r.id === initialRod.id);
  if (!data) return 0;
  return Math.min(
    levelStat(data.attackBase, data.attackPerLevel, initialRod.attackLevel),
    levelStat(data.defenseBase, data.defensePerLevel, initialRod.defenseLevel),
  );
}

function hasStoredField(key: string, field: string): boolean {
  try {
    const raw = localStorage.getItem(key);
    return raw != null && field in JSON.parse(raw);
  } catch {
    return false;
  }
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
  const [rodData, setRodData] = useState<RodData[]>([]);
  const [locationPercents, setLocationPercents] = useState<Map<string, number>>(
    new Map(),
  );

  useEffect(() => {
    loadRodData()
      .then((data) => {
        setRodData(data);
        if (!hasStoredField(SHARED_STORAGE_KEY, "startingAD")) {
          setStartingAD(initialPlayerAD(data));
        }
      })
      .catch(() => setRodData([]));
    loadLocationGameplayData()
      .then((data) =>
        setLocationPercents(new Map(data.map((e) => [e.fishId, e.percent]))),
      )
      .catch(() => setLocationPercents(new Map()));
  }, []);
  const [levels, setLevels] = useState<number>(
    () => loadStored(SHARED_STORAGE_KEY, { levels: 3, startingAD: 0 }).levels,
  );
  const [startingAD, setStartingAD] = useState<number>(
    () =>
      loadStored(SHARED_STORAGE_KEY, { levels: 3, startingAD: 0 }).startingAD,
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
                locationPercents={locationPercents}
              />
              {showPreview && (
                <LureCostTable
                  fishRows={fishRows}
                  shopRows={shopRows}
                  startingAD={startingAD}
                  rodData={rodData}
                  locationPercents={locationPercents}
                />
              )}
            </Flex>
            <Separator orientation="vertical" size="4" />
            <Flex direction="column" gap="3" style={{ flex: 1 }}>
              <TemplateShopGenerator
                shopKey="shop"
                onChange={(rows) => {
                  setShopRows(rows);
                  onShopRowsChange?.(rows);
                }}
                showPreview={showPreview}
                levels={levels}
              />
            </Flex>
          </Flex>
        </>
      )}
    </Flex>
  );
}
