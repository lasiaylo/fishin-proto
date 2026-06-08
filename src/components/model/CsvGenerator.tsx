import React, { useEffect, useState } from "react";
import { Flex, Text, Table, Button, Separator } from "@radix-ui/themes";
import { NumInput } from "./shared";

export const GENERATED_FISH_CSV = "__generated_fish__";
export const GENERATED_SHOP_CSV = "__generated_shop__";

type FnType = "LINEAR" | "EXPONENTIAL";

interface FunctionConfig {
  type: FnType;
  startValue: number;
  scaleFactor: number;
  growthRate: number;
}

function evalFn(cfg: FunctionConfig, lvl: number): number {
  return cfg.type === "LINEAR"
    ? cfg.startValue + cfg.growthRate * lvl
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
    ? `LINEAR startValue=${cfg.startValue} growthRate=${cfg.growthRate}`
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
        {value.type === "EXPONENTIAL" && (
          <NumInput
            label="ScaleFactor"
            value={value.scaleFactor}
            onChange={(v) => onChange({ ...value, scaleFactor: v })}
            min={-999}
            max={99999}
            step={0.5}
          />
        )}
        <NumInput
          label="GrowthRate"
          value={value.growthRate}
          onChange={(v) => onChange({ ...value, growthRate: v })}
          min={-999}
          max={99999}
          step={0.5}
        />
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

const DEFAULT_STATS_FN: FunctionConfig = {
  type: "LINEAR",
  startValue: 2,
  scaleFactor: 1,
  growthRate: 4,
};
const DEFAULT_PRICE_FN: FunctionConfig = {
  type: "LINEAR",
  startValue: 4,
  scaleFactor: 1,
  growthRate: 15,
};

function FishGenerator({
  onChange,
  showPreview,
}: {
  onChange?: (rows: string[][]) => void;
  showPreview: boolean;
}) {
  const [statsFn, setStatsFn] = useState<FunctionConfig>(DEFAULT_STATS_FN);
  const [priceFn, setPriceFn] = useState<FunctionConfig>(DEFAULT_PRICE_FN);
  const [variance, setVariance] = useState(0.1);
  const [levels, setLevels] = useState(3);

  const rows = generateFishRows(statsFn, priceFn, variance, levels);

  useEffect(() => {
    onChange?.(rows);
    // onChange is a stable useState setter — safe to omit from deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statsFn, priceFn, variance, levels]);

  return (
    <Flex direction="column" gap="3">
      <Text size="2" weight="bold">
        Fish
      </Text>
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
        <NumInput label="Levels" value={levels} onChange={setLevels} min={1} />
      </Flex>
      <Text size="1" color="gray">
        {rows.length - 1} fish · {levels} lure{levels !== 1 ? "s" : ""} required
      </Text>
      {showPreview && <PreviewTable rows={rows} />}
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

const DEFAULT_STAT_FN: FunctionConfig = {
  type: "LINEAR",
  startValue: 20,
  scaleFactor: 1,
  growthRate: 20,
};
const DEFAULT_LURE_FN: FunctionConfig = {
  type: "LINEAR",
  startValue: 10,
  scaleFactor: 1,
  growthRate: 25,
};

function ShopGenerator({
  onChange,
  showPreview,
}: {
  onChange?: (rows: string[][]) => void;
  showPreview: boolean;
}) {
  const [attackFn, setAttackFn] = useState<FunctionConfig>(DEFAULT_STAT_FN);
  const [attackVPL, setAttackVPL] = useState(1);
  const [attackCount, setAttackCount] = useState(4);

  const [defenseFn, setDefenseFn] = useState<FunctionConfig>(DEFAULT_STAT_FN);
  const [defenseVPL, setDefenseVPL] = useState(1);
  const [defenseCount, setDefenseCount] = useState(4);

  const [lureFn, setLureFn] = useState<FunctionConfig>(DEFAULT_LURE_FN);
  const [lureCount, setLureCount] = useState(3);

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
  ]);

  return (
    <Flex direction="column" gap="3">
      <Text size="2" weight="bold">
        Shop
      </Text>

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
        <NumInput
          label="Lures"
          value={lureCount}
          onChange={setLureCount}
          min={1}
        />
      </Flex>

      {showPreview && <PreviewTable rows={rows} />}
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
  const [showPreview, setShowPreview] = useState(false);

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
        )}
      </Flex>
      {open && (
        <Flex direction="row" gap="6" align="start">
          <Flex direction="column" gap="3" style={{ flex: 1 }}>
            <FishGenerator
              onChange={onFishRowsChange}
              showPreview={showPreview}
            />
          </Flex>
          <Separator orientation="vertical" size="4" />
          <Flex direction="column" gap="3" style={{ flex: 1 }}>
            <ShopGenerator
              onChange={onShopRowsChange}
              showPreview={showPreview}
            />
          </Flex>
        </Flex>
      )}
    </Flex>
  );
}
