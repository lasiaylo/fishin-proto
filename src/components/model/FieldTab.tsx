import React, { useEffect, useMemo, useState } from "react";
import { Flex, Text, Table, Switch, Card } from "@radix-ui/themes";
import { Bar, Line } from "recharts";
import {
  loadShopGameplayData,
  parseShopGameplayRows,
  type ShopUpgradeData,
} from "../../util/csvLoader";
import {
  DEFAULT_FIELD_OPTIONS,
  simulateField,
  type FieldOptions,
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

  const update = (patch: Partial<FieldOptions>) => {
    const next = { ...options, ...patch };
    setOptions(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const result = useMemo(
    () => simulateField(shopData, options),
    [shopData, options],
  );

  // Seconds waited before each purchase, measured from the previous one
  // (the first from the start of the run).
  const gapData = useMemo(
    () =>
      result.purchases.map((p, i) => ({
        index: i + 1,
        label: `${p.id} L${p.level}`,
        gap: p.time - (i > 0 ? result.purchases[i - 1].time : 0),
      })),
    [result],
  );
  const gapTickStep = Math.max(1, Math.ceil(gapData.length / 20));
  const gapTicks = gapData
    .map((d) => d.index)
    .filter((i) => i % gapTickStep === 0 || i === 1);

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
        <NumInput
          label="Reaction delay (s)"
          value={options.reactionDelayS}
          min={0}
          max={60}
          step={0.1}
          onChange={(v) => update({ reactionDelayS: v })}
        />
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
          {...chartProps}
        >
          <Line
            type="stepAfter"
            dataKey="totalEarned"
            name="Total earned"
            stroke={COLORS[0]}
            {...lineProps}
          />
          <Line
            type="stepAfter"
            dataKey="money"
            name="Wallet"
            stroke={COLORS[3]}
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
        <EconomyChart
          title="Sit Payout ($) / Cooldown (ms)"
          data={result.samples}
          integerYAxis
          integerRightYAxis
          tooltipLabelFormatter={(v) => formatTime(v)}
          {...chartProps}
        >
          <Line
            yAxisId="left"
            type="stepAfter"
            dataKey="payout"
            name="Payout"
            stroke={COLORS[4]}
            {...lineProps}
          />
          <Line
            yAxisId="right"
            type="stepAfter"
            dataKey="cooldownMs"
            name="Cooldown (ms)"
            stroke={COLORS[1]}
            {...lineProps}
          />
        </EconomyChart>
        {gapData.length > 0 && (
          <EconomyChart
            title="Time Between Upgrades"
            data={gapData}
            xDataKey="index"
            xDomain={[0.5, gapData.length + 0.5]}
            xTicks={gapTicks}
            xTickFormatter={(v) => String(v)}
            xLabel="Purchase #"
            integerXAxis
            yTickFormatter={formatTime}
            tooltipFormatter={(v) => formatTime(v)}
            tooltipLabelFormatter={(_, payload) => payload?.[0]?.payload.label}
            syncId="fieldGaps"
          >
            <Bar
              dataKey="gap"
              name="Since prev"
              fill={COLORS[6]}
              isAnimationActive={false}
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
