import React, { useEffect, useState } from "react";
import { Flex, Text, Table, Button, Separator } from "@radix-ui/themes";
import { NumInput } from "./shared";

export const GENERATED_FISH_CSV = "__generated_fish__";
export const GENERATED_SHOP_CSV = "__generated_shop__";

const FISH_STORAGE_KEY = "csvgen_fish";
const SHOP_STORAGE_KEY = "csvgen_shop";
const SHARED_STORAGE_KEY = "csvgen_shared";

function loadStored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch {}
  return fallback;
}

type FnType = "LINEAR" | "EXPONENTIAL";

interface FunctionConfig {
  type: FnType;
  startValue: number;
  scaleFactor: number;
  growthRate: number;
}

const DEFAULT_STATS_FN: FunctionConfig = {
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

function evalFn(cfg: FunctionConfig, lvl: number): number {
  return cfg.type === "LINEAR"
    ? cfg.startValue + cfg.scaleFactor * lvl
    : cfg.startValue + cfg.scaleFactor * Math.pow(lvl, cfg.growthRate);
}

function generateFishRows(
  statsFn: FunctionConfig,
  priceFn: FunctionConfig,
  variance: number,
  levels: number,
): string[][] {
  const rows: string[][] = [
    ["ID", "Attack", "Defense", "Thrash", "BasePrice", "RequiredLure"],
  ];
  let idx = 1;

  // Level 0: one fish, no lure required
  const s0 = Math.round(evalFn(statsFn, 0));
  const p0 = Math.round(evalFn(priceFn, 0));
  rows.push([`FISH_${idx++}`, String(s0), String(s0), "1", String(p0), ""]);

  // Levels 1..N: three fish each (min, middle, max)
  for (let l = 1; l <= levels; l++) {
    for (const mult of [1 - variance, 1, 1 + variance]) {
      const lvl = l * mult;
      const s = Math.round(evalFn(statsFn, lvl));
      const p = Math.round(evalFn(priceFn, lvl));
      rows.push([
        `FISH_${idx++}`,
        String(s),
        String(s),
        "1",
        String(p),
        `LURE_${l}`,
      ]);
    }
  }

  return rows;
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
): string[][] {
  const rows: string[][] = [
    ["ID", "Price", "Stat", "ValuePerLevel", "Requirement"],
  ];

  const attackPrices = Array.from({ length: attackCount }, (_, i) =>
    Math.round(evalFn(attackFn, i)),
  );
  rows.push([
    "ATTACK",
    attackPrices.join(" "),
    "ATTACK",
    String(attackVPL),
    "",
  ]);

  const defensePrices = Array.from({ length: defenseCount }, (_, i) =>
    Math.round(evalFn(defenseFn, i)),
  );
  rows.push([
    "DEFENSE",
    defensePrices.join(" "),
    "DEFENSE",
    String(defenseVPL),
    "",
  ]);

  for (let i = 0; i < lureCount; i++) {
    rows.push([
      `LURE_${i + 1}`,
      String(Math.round(evalFn(lureFn, i))),
      "LURE",
      "1",
      i === 0 ? "" : `LURE_${i}`,
    ]);
  }

  return rows;
}

function fnConfigStr(cfg: FunctionConfig): string {
  return cfg.type === "LINEAR"
    ? `LINEAR startValue=${cfg.startValue} scaleFactor=${cfg.scaleFactor}`
    : `EXPONENTIAL startValue=${cfg.startValue} scaleFactor=${cfg.scaleFactor} growthRate=${cfg.growthRate}`;
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
        <NumInput
          label="ScaleFactor"
          value={value.scaleFactor}
          onChange={(v) => onChange({ ...value, scaleFactor: v })}
          min={-999}
          max={99999}
          step={0.5}
        />
        {value.type === "EXPONENTIAL" && (
          <NumInput
            label="GrowthRate"
            value={value.growthRate}
            onChange={(v) => onChange({ ...value, growthRate: v })}
            min={0}
            max={1}
            step={0.01}
          />
        )}
      </Flex>
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
  statsFn: DEFAULT_STATS_FN,
  priceFn: DEFAULT_PRICE_FN,
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
  const [statsFn, setStatsFn] = useState<FunctionConfig>(() => stored.statsFn);
  const [priceFn, setPriceFn] = useState<FunctionConfig>(() => stored.priceFn);
  const [variance, setVariance] = useState(() => stored.variance);

  const rows = generateFishRows(statsFn, priceFn, variance, levels);

  useEffect(() => {
    localStorage.setItem(
      FISH_STORAGE_KEY,
      JSON.stringify({ statsFn, priceFn, variance }),
    );
    onChange?.(rows);
    // onChange is a stable useState setter — safe to omit from deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statsFn, priceFn, variance, levels]);

  function reset() {
    setStatsFn(FISH_DEFAULTS.statsFn);
    setPriceFn(FISH_DEFAULTS.priceFn);
    setVariance(FISH_DEFAULTS.variance);
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
      <Flex direction="row" gap="4" align="start">
        <FunctionSelect
          label="Attack / Defense curve"
          value={statsFn}
          onChange={setStatsFn}
        />
        <FunctionSelect
          label="Base Price curve"
          value={priceFn}
          onChange={setPriceFn}
        />
      </Flex>
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
        <PreviewTable
          rows={[
            ["ID", "A/D", "BasePrice"],
            ...rows
              .slice(1)
              .filter((_, i) => i === 0 || (i - 2) % 3 === 0)
              .map((r) => [r[0], r[1], r[4]]),
          ]}
        />
      )}
      <Button
        size="1"
        variant="soft"
        style={{ width: "fit-content" }}
        onClick={() => {
          const comment = [
            `# Attack/Defense curve: ${fnConfigStr(statsFn)}`,
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
  mergeStats: false,
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
  const [mergeStats, setMergeStats] = useState(
    () => stored.mergeStats ?? false,
  );

  function handleAttackFnChange(v: FunctionConfig) {
    setAttackFn(v);
    if (mergeStats) setDefenseFn(v);
  }
  function handleAttackVPLChange(v: number) {
    setAttackVPL(v);
    if (mergeStats) setDefenseVPL(v);
  }
  function handleAttackCountChange(v: number) {
    setAttackCount(v);
    if (mergeStats) setDefenseCount(v);
  }

  const rows = generateShopRows(
    attackFn,
    attackVPL,
    attackCount,
    defenseFn,
    defenseVPL,
    defenseCount,
    lureFn,
    lureCount,
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
        mergeStats,
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
    mergeStats,
  ]);

  function reset() {
    setAttackFn(SHOP_DEFAULTS.attackFn);
    setAttackVPL(SHOP_DEFAULTS.attackVPL);
    setAttackCount(SHOP_DEFAULTS.attackCount);
    setDefenseFn(SHOP_DEFAULTS.defenseFn);
    setDefenseVPL(SHOP_DEFAULTS.defenseVPL);
    setDefenseCount(SHOP_DEFAULTS.defenseCount);
    setLureFn(SHOP_DEFAULTS.lureFn);
    setMergeStats(SHOP_DEFAULTS.mergeStats);
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
          checked={mergeStats}
          onChange={(e) => {
            const checked = e.target.checked;
            setMergeStats(checked);
            if (checked) {
              setDefenseFn(attackFn);
              setDefenseVPL(attackVPL);
              setDefenseCount(attackCount);
            }
          }}
        />
        <Text size="1" color="gray">
          Merge Attack / Defense
        </Text>
      </label>

      {mergeStats ? (
        <Flex direction="row" gap="4" align="start">
          <Flex direction="column" gap="2">
            <Text size="1" weight="bold">
              ATTACK / DEFENSE
            </Text>
            <FunctionSelect
              label="Price curve"
              value={attackFn}
              onChange={handleAttackFnChange}
            />
            <Flex gap="3" wrap="wrap" align="end">
              <NumInput
                label="ValuePerLevel"
                value={attackVPL}
                onChange={handleAttackVPLChange}
                min={1}
              />
              <NumInput
                label="Upgrades"
                value={attackCount}
                onChange={handleAttackCountChange}
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
        </Flex>
      ) : (
        <>
          <Flex direction="row" gap="4" align="start">
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
        </>
      )}

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
            `# ATTACK price curve: ${fnConfigStr(attackFn)} | ValuePerLevel=${attackVPL} | Upgrades=${attackCount}`,
            `# DEFENSE price curve: ${fnConfigStr(defenseFn)} | ValuePerLevel=${defenseVPL} | Upgrades=${defenseCount}`,
            `# LURE price curve: ${fnConfigStr(lureFn)} | Lures=${lureCount}`,
          ].join("\n");
          downloadCsv(rows, "ShopGameplay.csv", comment);
        }}
      >
        Download ShopGameplay.csv
      </Button>
    </Flex>
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
  const [open, setOpen] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [levels, setLevels] = useState<number>(
    () => loadStored(SHARED_STORAGE_KEY, { levels: 3 }).levels,
  );

  function handleLevelsChange(v: number) {
    setLevels(v);
    localStorage.setItem(SHARED_STORAGE_KEY, JSON.stringify({ levels: v }));
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
        <Flex direction="row" gap="6" align="start">
          <Flex direction="column" gap="3" style={{ flex: 1 }}>
            <FishGenerator
              onChange={onFishRowsChange}
              showPreview={showPreview}
              levels={levels}
            />
          </Flex>
          <Separator orientation="vertical" size="4" />
          <Flex direction="column" gap="3" style={{ flex: 1 }}>
            <ShopGenerator
              onChange={onShopRowsChange}
              showPreview={showPreview}
              lureCount={levels}
            />
          </Flex>
        </Flex>
      )}
    </Flex>
  );
}
