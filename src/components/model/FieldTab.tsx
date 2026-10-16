import React, { useEffect, useMemo, useState } from "react";
import { Flex, Text, Table, Switch, Card } from "@radix-ui/themes";
import { Line } from "recharts";
import {
  loadShopGameplayData,
  parseShopGameplayRows,
  type ShopUpgradeData,
} from "../../util/csvLoader";
import {
  DEFAULT_FIELD_OPTIONS,
  simulateField,
  type FieldOptions,
  type FieldStrategy,
  type FieldSample,
} from "../../game/FieldModel";
import {
  ChartGrid,
  COLORS,
  CsvSelect,
  GridToggleButton,
  NumInput,
} from "./shared";
import { SHOP_CSVS } from "../../stores/csvConfigStore";
import { CsvGeneratorPanel, GENERATED_SHOP_CSV } from "./CsvGenerator";
import { EconomyChart, lineProps } from "./EconomyChart";

const STORAGE_KEY = "fieldModelOptions";
const X_TICK_SECONDS = 5 * 60;

function loadOptions(): FieldOptions {
  try {
    return {
      ...DEFAULT_FIELD_OPTIONS,
      ...JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}"),
    };
  } catch {
    return DEFAULT_FIELD_OPTIONS;
  }
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <Flex direction="column" gap="1">
        <Text size="1" color="gray">
          {label}
        </Text>
        <Text size="4" weight="bold">
          {value}
        </Text>
      </Flex>
    </Card>
  );
}

function SeriesLegend({
  items,
  hidden,
  onToggle,
}: {
  items: { key: string; label: string; color: string }[];
  hidden: Set<string>;
  onToggle: (key: string) => void;
}) {
  return (
    <Flex gap="3" wrap="wrap">
      {items.map(({ key, label, color }) => (
        <Text
          key={key}
          size="1"
          onClick={() => onToggle(key)}
          style={{
            color,
            cursor: "pointer",
            opacity: hidden.has(key) ? 0.35 : 1,
            textDecoration: hidden.has(key) ? "line-through" : undefined,
          }}
        >
          ● {label}
        </Text>
      ))}
    </Flex>
  );
}

export function FieldTab({
  shopData: defaultShopData,
  generatedShopRows,
  onFishRowsChange,
  onShopRowsChange,
}: {
  shopData: ShopUpgradeData[];
  generatedShopRows: string[][] | null;
  onFishRowsChange: (rows: string[][]) => void;
  onShopRowsChange: (rows: string[][]) => void;
}) {
  const [options, setOptions] = useState<FieldOptions>(loadOptions);
  const [selectedShopCSV, setSelectedShopCSV] = useState(
    () =>
      localStorage.getItem("fieldTab.shopCSV") ??
      SHOP_CSVS[0] ??
      "ShopGameplay.csv",
  );
  const [shopData, setShopData] = useState<ShopUpgradeData[]>(defaultShopData);

  useEffect(() => {
    if (selectedShopCSV === GENERATED_SHOP_CSV) {
      if (generatedShopRows)
        setShopData(parseShopGameplayRows(generatedShopRows));
    } else {
      loadShopGameplayData(selectedShopCSV).then(setShopData);
    }
  }, [selectedShopCSV, generatedShopRows]);
  const [gridLayout, setGridLayout] = useState(true);
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set());
  const toggleSeries = (key: string) =>
    setHiddenSeries((prev) => {
      const next = new Set(prev);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  const update = (patch: Partial<FieldOptions>) => {
    const next = { ...options, ...patch };
    setOptions(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const result = useMemo(
    () => simulateField(shopData, options),
    [shopData, options],
  );

  // Seconds waited before each purchase (measured from the previous one, the
  // first from the start of the run), one row per upgrade level with a column
  // per upgrade.
  const { gapData, gapIds, gapMaxLevel } = useMemo(() => {
    const ids: string[] = [];
    const rows = new Map<number, Record<string, number>>();
    result.purchases.forEach((p, i) => {
      if (!ids.includes(p.id)) ids.push(p.id);
      const row = rows.get(p.level) ?? { level: p.level };
      row[p.id] = p.time - (i > 0 ? result.purchases[i - 1].time : 0);
      rows.set(p.level, row);
    });
    const data = [...rows.values()].sort((x, y) => x.level - y.level);
    return {
      gapData: data,
      gapIds: ids,
      gapMaxLevel: data.length ? data[data.length - 1].level : 1,
    };
  }, [result]);
  // Same gaps, but one row per purchase across every upgrade.
  const anyGapData = useMemo(
    () =>
      result.purchases.map((p, i) => ({
        index: i + 1,
        label: `${p.id} L${p.level}`,
        gap: p.time - (i > 0 ? result.purchases[i - 1].time : 0),
      })),
    [result],
  );
  const anyGapTickStep = Math.max(1, Math.ceil(anyGapData.length / 20));
  const anyGapTicks = anyGapData
    .map((d) => d.index)
    .filter((i) => i % anyGapTickStep === 0 || i === 1);
  const gapTickStep = Math.max(1, Math.ceil(gapMaxLevel / 20));
  const gapTicks = Array.from({ length: gapMaxLevel }, (_, i) => i + 1).filter(
    (l) => l % gapTickStep === 0 || l === 1,
  );

  // Round the axis up to a whole tick so the last 5-minute mark is shown.
  const maxTime = Math.max(
    X_TICK_SECONDS,
    Math.ceil(result.endTime / X_TICK_SECONDS) * X_TICK_SECONDS,
  );
  const xTicks = Array.from(
    { length: maxTime / X_TICK_SECONDS + 1 },
    (_, i) => i * X_TICK_SECONDS,
  );
  const chartProps = { maxTime, xTicks, syncId: "field" };

  return (
    <Flex direction="column" gap="4" pt="4">
      <CsvGeneratorPanel
        onFishRowsChange={onFishRowsChange}
        onShopRowsChange={onShopRowsChange}
        shopTab="fields"
        fishOpen={false}
      />

      <Flex gap="3" align="end" wrap="wrap">
        <CsvSelect
          label="Shop CSV"
          value={selectedShopCSV}
          csvs={SHOP_CSVS}
          generatedValue={GENERATED_SHOP_CSV}
          showGenerated={!!generatedShopRows}
          onChange={(v) => {
            setSelectedShopCSV(v);
            localStorage.setItem("fieldTab.shopCSV", v);
          }}
        />
        <NumInput
          label="Max minutes"
          value={options.maxMinutes}
          min={1}
          max={600}
          onChange={(v) => update({ maxMinutes: v })}
        />
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <Text size="1" color="gray">
            Upgrade choice
          </Text>
          <select
            value={options.strategy}
            onChange={(e) =>
              update({ strategy: e.target.value as FieldStrategy })
            }
          >
            <option value="efficient">Most efficient</option>
            <option value="cheapest">Cheapest</option>
          </select>
        </label>
        <Text as="label" size="1" color="gray">
          <Flex gap="2" align="center">
            <Switch
              checked={options.stopAtPond}
              onCheckedChange={(v) => update({ stopAtPond: v })}
            />
            Stop at pond unlock
          </Flex>
        </Text>
        <GridToggleButton
          gridLayout={gridLayout}
          onToggle={() => setGridLayout((g) => !g)}
        />
      </Flex>

      <Flex gap="3" wrap="wrap">
        <Stat
          label="Pond unlocked at"
          value={
            result.pondUnlockedAt === null
              ? "never"
              : formatTime(result.pondUnlockedAt)
          }
        />
        <Stat label="Total sits" value={String(result.totalSits)} />
        <Stat label="Total earned" value={`$${result.totalEarned}`} />
        <Stat
          label="Final income"
          value={`$${result.finalIncomePerMin.toFixed(1)}/min`}
        />
      </Flex>

      <ChartGrid gridLayout={gridLayout}>
        <EconomyChart
          title="Money"
          data={result.samples}
          integerYAxis
          tooltipLabelFormatter={(v) => formatTime(v)}
          header={
            <SeriesLegend
              items={[
                {
                  key: "money:totalEarned",
                  label: "Total earned",
                  color: COLORS[0],
                },
                { key: "money:wallet", label: "Wallet", color: COLORS[3] },
              ]}
              hidden={hiddenSeries}
              onToggle={toggleSeries}
            />
          }
          {...chartProps}
        >
          <Line
            type="stepAfter"
            dataKey="totalEarned"
            name="Total earned"
            stroke={COLORS[0]}
            hide={hiddenSeries.has("money:totalEarned")}
            {...lineProps}
          />
          <Line
            type="stepAfter"
            dataKey="money"
            name="Wallet"
            stroke={COLORS[3]}
            hide={hiddenSeries.has("money:wallet")}
            {...lineProps}
          />
        </EconomyChart>
        <EconomyChart
          title="Income Rate ($/min)"
          data={result.samples}
          tooltipLabelFormatter={(v) => formatTime(v)}
          {...chartProps}
        >
          <Line
            type="stepAfter"
            dataKey="incomePerMin"
            name="$/min"
            stroke={COLORS[2]}
            {...lineProps}
          />
          <Line
            type="stepAfter"
            dataKey={(d: FieldSample) => d.windPerS * 60}
            name="Wind $/min"
            stroke={COLORS[6]}
            {...lineProps}
          />
        </EconomyChart>
        {gapData.length > 0 && (
          <EconomyChart
            title="Time Between Upgrades"
            data={gapData}
            xDataKey="level"
            xDomain={[1, Math.max(2, gapMaxLevel)]}
            xTicks={gapTicks}
            xTickFormatter={(v) => String(v)}
            xLabel="Upgrade level"
            integerXAxis
            yTickFormatter={formatTime}
            tooltipFormatter={(v) => formatTime(v)}
            tooltipLabelFormatter={(v) => `Level ${v}`}
            syncId="fieldGaps"
            header={
              <SeriesLegend
                items={gapIds.map((id, i) => ({
                  key: `gap:${id}`,
                  label: id,
                  color: COLORS[i % COLORS.length],
                }))}
                hidden={hiddenSeries}
                onToggle={toggleSeries}
              />
            }
          >
            {gapIds.map((id, i) => (
              <Line
                key={id}
                type="monotone"
                dataKey={id}
                name={id}
                stroke={COLORS[i % COLORS.length]}
                connectNulls
                hide={hiddenSeries.has(`gap:${id}`)}
                {...lineProps}
                dot
              />
            ))}
          </EconomyChart>
        )}
        {anyGapData.length > 0 && (
          <EconomyChart
            title="Time Between Upgrades (Any Upgrade)"
            data={anyGapData}
            xDataKey="index"
            xDomain={[1, Math.max(2, anyGapData.length)]}
            xTicks={anyGapTicks}
            xTickFormatter={(v) => String(v)}
            xLabel="Purchase #"
            integerXAxis
            yTickFormatter={formatTime}
            tooltipFormatter={(v) => formatTime(v)}
            tooltipLabelFormatter={(_, payload) => payload?.[0]?.payload.label}
            syncId="fieldAnyGaps"
          >
            <Line
              type="monotone"
              dataKey="gap"
              name="Since prev"
              stroke={COLORS[6]}
              {...lineProps}
            />
          </EconomyChart>
        )}
      </ChartGrid>

      <Flex direction="column" gap="2">
        <Text size="2" weight="bold">
          Purchases
        </Text>
        {result.purchases.length === 0 ? (
          <Text size="2" color="gray">
            Nothing bought.
          </Text>
        ) : (
          <Table.Root variant="surface" size="1">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeaderCell>Time</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Upgrade</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Cost</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Since prev</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Sits</Table.ColumnHeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {result.purchases.map((p, i) => (
                <Table.Row key={`${p.id}-${p.level}`}>
                  <Table.Cell>{formatTime(p.time)}</Table.Cell>
                  <Table.Cell>
                    {p.id} L{p.level}
                  </Table.Cell>
                  <Table.Cell>${p.cost}</Table.Cell>
                  <Table.Cell>
                    {formatTime(
                      p.time - (i > 0 ? result.purchases[i - 1].time : 0),
                    )}
                  </Table.Cell>
                  <Table.Cell>{p.sits}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        )}
      </Flex>
    </Flex>
  );
}
