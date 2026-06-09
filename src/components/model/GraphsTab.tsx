import React, { useState, useEffect, useRef } from "react";
import { Button, Flex, Text } from "@radix-ui/themes";
import { Line, ReferenceArea, Legend } from "recharts";
import { computeLureStats } from "../../game/EconomyModel";
import type {
  FishData,
  LocationFishEntry,
  ShopUpgradeData,
} from "../../util/csvLoader";
import {
  StatName,
  loadFishData,
  loadShopGameplayData,
  parseFishGameplayRows,
  parseShopGameplayRows,
} from "../../util/csvLoader";
import {
  ChartGrid,
  COLORS,
  CsvSelect,
  GridToggleButton,
  NumInput,
} from "./shared";
import { INITIAL_PLAYER_STATE } from "../../stores/playerStore";
import { FISH_CSVS, SHOP_CSVS } from "../../stores/csvConfigStore";
import {
  CsvGeneratorPanel,
  GENERATED_FISH_CSV,
  GENERATED_SHOP_CSV,
} from "./CsvGenerator";
import { EconomyChart, lineProps } from "./EconomyChart";

export function GraphsTab({
  fishData: defaultFishData,
  locationData,
  generatedFishRows,
  generatedShopRows,
  onFishRowsChange,
  onShopRowsChange,
}: {
  fishData: FishData[];
  locationData: LocationFishEntry[];
  generatedFishRows: string[][] | null;
  generatedShopRows: string[][] | null;
  onFishRowsChange: (rows: string[][]) => void;
  onShopRowsChange: (rows: string[][]) => void;
}) {
  const [lineHP, setLineHP] = useState(INITIAL_PLAYER_STATE.lineHP);
  const [minStat, setMinStat] = useState(1);
  const [maxStat, setMaxStat] = useState(40);
  const [trialsPerFish, setTrialsPerFish] = useState(200);
  const [inventorySize, setInventorySize] = useState(3);
  const [sweepData, setSweepData] = useState<object[]>([]);
  const [running, setRunning] = useState(false);
  const [runCount, setRunCount] = useState(0);
  const paramsRef = useRef({
    activeFishData: defaultFishData,
    activeShopData: [] as ShopUpgradeData[],
    locationData,
    lineHP,
    inventorySize,
    minStat,
    maxStat,
    trialsPerFish,
  });
  const hasAutoRun = useRef(false);
  const [gridLayout, setGridLayout] = useState(true);
  const [selectedFishCSV, setSelectedFishCSV] = useState(
    () =>
      localStorage.getItem("graphsTab.fishCSV") ??
      FISH_CSVS[0] ??
      "FishGameplay.csv",
  );
  const [activeFishData, setActiveFishData] =
    useState<FishData[]>(defaultFishData);
  const [selectedShopCSV, setSelectedShopCSV] = useState(
    () =>
      localStorage.getItem("graphsTab.shopCSV") ??
      SHOP_CSVS[0] ??
      "ShopGameplay.csv",
  );
  const [activeShopData, setActiveShopData] = useState<ShopUpgradeData[]>([]);

  useEffect(() => {
    if (selectedFishCSV === GENERATED_FISH_CSV) {
      if (generatedFishRows) {
        setActiveFishData(parseFishGameplayRows(generatedFishRows));
      }
    } else {
      loadFishData(selectedFishCSV).then(setActiveFishData);
    }
  }, [selectedFishCSV, generatedFishRows]);

  useEffect(() => {
    if (selectedShopCSV === GENERATED_SHOP_CSV) {
      if (generatedShopRows) {
        setActiveShopData(parseShopGameplayRows(generatedShopRows));
      }
    } else {
      loadShopGameplayData(selectedShopCSV).then(setActiveShopData);
    }
  }, [selectedShopCSV, generatedShopRows]);

  const lureIds = [...new Set(activeFishData.map((f) => f.requiredLure))];
  const lureColors = Object.fromEntries(
    lureIds.map((id, i) => [id, COLORS[i % COLORS.length]]),
  );

  useEffect(() => {
    paramsRef.current = {
      activeFishData,
      activeShopData,
      locationData,
      lineHP,
      inventorySize,
      minStat,
      maxStat,
      trialsPerFish,
    };
  }, [
    activeFishData,
    activeShopData,
    locationData,
    lineHP,
    inventorySize,
    minStat,
    maxStat,
    trialsPerFish,
  ]);

  useEffect(() => {
    if (!hasAutoRun.current && activeFishData.length > 0) {
      hasAutoRun.current = true;
      setRunCount((c) => c + 1);
    }
  }, [activeFishData]);

  useEffect(() => {
    if (runCount === 0) return;
    const {
      activeFishData,
      activeShopData,
      locationData,
      lineHP,
      inventorySize,
      minStat,
      maxStat,
      trialsPerFish,
    } = paramsRef.current;
    if (activeFishData.length === 0) return;
    setRunning(true);
    const id = setTimeout(() => {
      const data: object[] = [];
      const clampedMin = Math.min(minStat, maxStat);
      const clampedMax = Math.max(minStat, maxStat);
      const atkUpgrade = activeShopData.find((u) => u.stat === StatName.ATTACK);

      for (let s = clampedMin; s <= clampedMax; s++) {
        const { rates, earnings, winRates, remainingHPs } = computeLureStats(
          activeFishData,
          locationData,
          { attack: s, defense: s, lineHP, inventorySize },
          trialsPerFish,
        );
        const winRateKeyed = Object.fromEntries(
          Object.entries(winRates).map(([k, v]) => [`wr_${k}`, v]),
        );
        const remainingHPKeyed = Object.fromEntries(
          Object.entries(remainingHPs).map(([k, v]) => [`hp_${k}`, v]),
        );
        const rateEntries = Object.entries(rates);
        const [bestLureId, bestRate] =
          rateEntries.length > 0
            ? rateEntries.reduce((a, b) => (b[1] > a[1] ? b : a))
            : ["", 0];
        const bestTripIncome = (earnings[bestLureId] ?? 0) * inventorySize;
        let attackUpgradeCost: number | null = null;
        if (atkUpgrade && atkUpgrade.valuePerLevel > 0) {
          const level = Math.max(
            0,
            Math.floor(
              (s - INITIAL_PLAYER_STATE.attack) / atkUpgrade.valuePerLevel,
            ),
          );
          attackUpgradeCost =
            level < atkUpgrade.prices.length ? atkUpgrade.prices[level] : null;
        }
        data.push({
          stat: s,
          ...rates,
          ...winRateKeyed,
          ...remainingHPKeyed,
          bestRate,
          bestLureId,
          bestTripIncome,
          attackUpgradeCost,
        });
      }

      setSweepData(data);
      setRunning(false);
    }, 0);
    return () => clearTimeout(id);
  }, [runCount]);

  const bestRegions: { x1: number; x2: number; lureId: string }[] = [];
  if (sweepData.length > 0) {
    let regionStart = (sweepData[0] as any).stat as number;
    for (let i = 0; i < sweepData.length; i++) {
      const d = sweepData[i] as any;
      const next = sweepData[i + 1] as any;
      if (!next || next.bestLureId !== d.bestLureId) {
        bestRegions.push({ x1: regionStart, x2: d.stat, lureId: d.bestLureId });
        regionStart = d.stat;
      }
    }
  }
  const activeBestLureIds = [...new Set(bestRegions.map((r) => r.lureId))];

  const lureTable = lureIds.map((lureId) => {
    const group = activeFishData.filter((f) => f.requiredLure === lureId);
    const avgAtk = group.reduce((s, f) => s + f.attack, 0) / group.length;
    const avgDef = group.reduce((s, f) => s + f.defense, 0) / group.length;
    const avgPrice = group.reduce((s, f) => s + f.basePrice, 0) / group.length;
    return { lureId, count: group.length, avgAtk, avgDef, avgPrice };
  });

  const statChartProps = {
    xDataKey: "stat" as const,
    xDomain: [minStat, maxStat] as [number, number],
    xTickFormatter: String,
    xLabel: "Attack / Defense",
    syncId: "graphs",
    height: 300,
  };

  return (
    <Flex direction="column" gap="4" pt="4">
      <CsvGeneratorPanel
        onFishRowsChange={onFishRowsChange}
        onShopRowsChange={onShopRowsChange}
      />

      <Flex gap="3" wrap="wrap" align="end">
        <CsvSelect
          label="Fish CSV"
          value={selectedFishCSV}
          csvs={FISH_CSVS}
          generatedValue={GENERATED_FISH_CSV}
          showGenerated={!!generatedFishRows}
          onChange={(v) => {
            setSelectedFishCSV(v);
            localStorage.setItem("graphsTab.fishCSV", v);
          }}
        />
        <CsvSelect
          label="Shop CSV"
          value={selectedShopCSV}
          csvs={SHOP_CSVS}
          generatedValue={GENERATED_SHOP_CSV}
          showGenerated={!!generatedShopRows}
          onChange={(v) => {
            setSelectedShopCSV(v);
            localStorage.setItem("graphsTab.shopCSV", v);
          }}
        />
        <NumInput label="Line HP" value={lineHP} onChange={setLineHP} min={1} />
        <NumInput
          label="Min Stat"
          value={minStat}
          onChange={setMinStat}
          min={1}
        />
        <NumInput
          label="Max Stat"
          value={maxStat}
          onChange={setMaxStat}
          min={1}
        />
        <NumInput
          label="Fish/trip"
          value={inventorySize}
          onChange={setInventorySize}
          min={1}
        />
        <NumInput
          label="Trials/fish"
          value={trialsPerFish}
          onChange={setTrialsPerFish}
          min={1}
          max={1000}
        />
        <Button
          variant="soft"
          disabled={running}
          onClick={() => setRunCount((c) => c + 1)}
        >
          {running ? "Running…" : "Refresh"}
        </Button>
        <GridToggleButton
          gridLayout={gridLayout}
          onToggle={() => setGridLayout((g) => !g)}
        />
      </Flex>

      {sweepData.length > 0 && (
        <ChartGrid gridLayout={gridLayout}>
          <EconomyChart
            title="Best Trip Income vs Attack &amp; Defense"
            data={sweepData}
            {...statChartProps}
            header={activeBestLureIds.map((id) => (
              <Flex key={id} align="center" gap="1">
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 2,
                    backgroundColor: lureColors[id],
                    opacity: 0.8,
                  }}
                />
                <Text size="1" color="gray">
                  {id === "" ? "No Lure" : id}
                </Text>
              </Flex>
            ))}
            // @ts-ignore
            tooltipFormatter={(v: number, _name: string, props: any) => [
              `$${(+v).toFixed(2)} (${props.payload.bestLureId === "" ? "No Lure" : props.payload.bestLureId})`,
              "Income/Trip",
            ]}
            tooltipLabelFormatter={(v: number) => `Stat: ${v}`}
          >
            {bestRegions.map((region, i) => (
              <ReferenceArea
                key={i}
                x1={region.x1}
                x2={region.x2}
                fill={lureColors[region.lureId]}
                fillOpacity={0.12}
                ifOverflow="hidden"
              />
            ))}
            <Line
              dataKey="bestTripIncome"
              stroke="#ffffff"
              name="Income/Trip"
              {...lineProps}
            />
            <Line
              dataKey="attackUpgradeCost"
              stroke="#ff6b6b"
              name="Atk Upgrade Cost"
              {...lineProps}
              connectNulls={false}
            />
          </EconomyChart>

          <EconomyChart
            title="Lure Income Rate vs Attack & Defense"
            data={sweepData}
            {...statChartProps}
            tooltipFormatter={(v: number) => +v.toFixed(3) as any}
            tooltipLabelFormatter={(v: number) => `Stat: ${v}`}
          >
            <Legend />
            {lureIds.map((id) => (
              <Line
                key={id}
                dataKey={id}
                stroke={lureColors[id]}
                name={id === "" ? "No Lure" : id}
                {...lineProps}
                connectNulls={false}
              />
            ))}
          </EconomyChart>

          <EconomyChart
            title="Lure Win Rate vs Attack & Defense"
            data={sweepData}
            {...statChartProps}
            yDomain={[0, 1]}
            yTickFormatter={(v: number) => `${Math.round(v * 100)}%`}
            tooltipFormatter={(v: number) => `${(v * 100).toFixed(1)}%` as any}
            tooltipLabelFormatter={(v: number) => `Stat: ${v}`}
          >
            <Legend />
            {lureIds.map((id) => (
              <Line
                key={id}
                dataKey={`wr_${id}`}
                stroke={lureColors[id]}
                name={id === "" ? "No Lure" : id}
                {...lineProps}
                connectNulls={false}
              />
            ))}
          </EconomyChart>

          <EconomyChart
            title="Remaining Line HP % vs Attack & Defense"
            data={sweepData}
            {...statChartProps}
            yDomain={[0, 100]}
            yTickFormatter={(v: number) => `${Math.round(v)}%`}
            tooltipFormatter={(v: number) => `${v.toFixed(1)}%` as any}
            tooltipLabelFormatter={(v: number) => `Stat: ${v}`}
          >
            <Legend />
            {lureIds.map((id) => (
              <Line
                key={id}
                dataKey={`hp_${id}`}
                stroke={lureColors[id]}
                name={id === "" ? "No Lure" : id}
                {...lineProps}
                connectNulls={false}
              />
            ))}
          </EconomyChart>
        </ChartGrid>
      )}

      {activeFishData.length > 0 && (
        <Flex direction="column" gap="2">
          <Text size="2" weight="bold">
            Avg Lure Stats
          </Text>
          <table
            style={{
              borderCollapse: "collapse",
              fontSize: 13,
              width: "fit-content",
            }}
          >
            <thead>
              <tr>
                {["Lure", "Fish", "Attack", "Defense", "Total", "Price"].map(
                  (h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: "left",
                        padding: "4px 16px 4px 0",
                        borderBottom: "1px solid #444",
                        color: "#aaa",
                        fontWeight: 500,
                      }}
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {lureTable.map(({ lureId, count, avgAtk, avgDef, avgPrice }) => (
                <tr key={lureId}>
                  <td
                    style={{
                      padding: "3px 16px 3px 0",
                      color: lureColors[lureId],
                    }}
                  >
                    {lureId === "" ? "No Lure" : lureId}
                  </td>
                  <td style={{ padding: "3px 16px 3px 0" }}>{count}</td>
                  <td style={{ padding: "3px 16px 3px 0" }}>
                    {avgAtk.toFixed(1)}
                  </td>
                  <td style={{ padding: "3px 16px 3px 0" }}>
                    {avgDef.toFixed(1)}
                  </td>
                  <td style={{ padding: "3px 16px 3px 0" }}>
                    {(avgAtk + avgDef).toFixed(1)}
                  </td>
                  <td style={{ padding: "3px 16px 3px 0" }}>
                    {avgPrice.toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Flex>
      )}
    </Flex>
  );
}
