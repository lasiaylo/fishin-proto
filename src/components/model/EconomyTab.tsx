import React, { useState } from "react";
import { Flex, Text, Table, Button } from "@radix-ui/themes";
import {
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { simulateEconomy, type EconomyRound } from "../../game/EconomyModel";
import { StatName } from "../../util/csvLoader";
import type {
  FishData,
  LocationFishEntry,
  ShopUpgradeData,
} from "../../util/csvLoader";
import { ChartGrid, COLORS, GridToggleButton, NumInput } from "./shared";
import { INITIAL_PLAYER_STATE } from "../../stores/playerStore";

const lineProps = {
  dot: false as const,
  strokeWidth: 2,
  isAnimationActive: false,
};

function EconomyChart({
  title,
  data,
  maxTime,
  xTicks,
  integerYAxis,
  header,
  children,
  xDataKey = "time",
  xDomain,
  xTickFormatter,
  syncId = "economy",
}: {
  title: string;
  data: object[];
  maxTime: number;
  xTicks?: number[];
  integerYAxis?: boolean;
  header?: React.ReactNode;
  children: React.ReactNode;
  xDataKey?: string;
  xDomain?: [number, number];
  xTickFormatter?: (v: number) => string;
  syncId?: string;
}) {
  // @ts-ignore
  return (
    <Flex direction="column" gap="2">
      <Flex align="center" gap="4" wrap="wrap">
        <Text size="2" weight="bold">
          {title}
        </Text>
        {header}
      </Flex>
      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={data} syncId={syncId}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis
            dataKey={xDataKey}
            type="number"
            domain={xDomain ?? [0, maxTime]}
            ticks={xTicks}
            tickFormatter={xTickFormatter ?? ((v: number) => `${v / 60}`)}
          />
          <YAxis allowDecimals={!integerYAxis} />
          <Tooltip
            labelStyle={{ color: "#111" }}
            // @ts-ignore
            formatter={(v: number) => +v.toFixed(2)}
            // @ts-ignore
            labelFormatter={(label: number) => +Number(label).toFixed(2)}
          />
          {children}
        </ComposedChart>
      </ResponsiveContainer>
    </Flex>
  );
}

export function EconomyTab({
  fishData,
  shopData,
  locationData,
}: {
  fishData: FishData[];
  shopData: ShopUpgradeData[];
  locationData: LocationFishEntry[];
}) {
  const [reelStr, setReelStr] = useState(INITIAL_PLAYER_STATE.attack);
  const [drag, setDrag] = useState(INITIAL_PLAYER_STATE.defense);
  const [lineHP, setLineHP] = useState(INITIAL_PLAYER_STATE.lineHP);
  const [inventorySize, setInventorySize] = useState(
    INITIAL_PLAYER_STATE.inventorySize,
  );
  const [simMinutes, setSimMinutes] = useState(10);
  const [rounds, setRounds] = useState<EconomyRound[]>([]);
  const [running, setRunning] = useState(false);
  const [gridLayout, setGridLayout] = useState(true);

  const nonLureUpgrades = shopData.filter((u) => u.stat !== StatName.LURE);

  function runSim() {
    setRunning(true);
    setTimeout(() => {
      setRounds(
        simulateEconomy(
          fishData,
          shopData,
          locationData,
          { attack: reelStr, defense: drag, lineHP, inventorySize },
          simMinutes,
        ),
      );
      setRunning(false);
    }, 0);
  }

  const rateData = rounds.map((r) => ({
    time: r.cumulativeTime,
    rate: parseFloat(r.rate.toFixed(4)),
    upgrade: r.upgradesBought.length > 0 ? parseFloat(r.rate.toFixed(4)) : null,
  }));

  const ratePerRoundData = rounds.map((r) => ({
    round: r.round,
    income: parseFloat(r.income.toFixed(4)),
    upgrade:
      r.upgradesBought.length > 0 ? parseFloat(r.income.toFixed(4)) : null,
  }));

  const maxTime =
    rounds.length > 0 ? rounds[rounds.length - 1].cumulativeTime : 0;
  const xTicks = Array.from(
    { length: Math.floor(maxTime / 60) + 1 },
    (_, i) => i * 60,
  );

  const catchTimeData = rounds.map((r) => ({
    time: r.cumulativeTime,
    ...Object.fromEntries(
      fishData.map((f) => [f.id, r.fishCatchTimes[f.id] ?? null]),
    ),
  }));

  const earningsData = rounds.map((r) => ({
    time: r.cumulativeTime,
    ...Object.fromEntries(
      fishData.map((f) => [`${f.id}_earn`, r.fishEarnings[f.id] ?? null]),
    ),
  }));

  const playerStatData = rounds.map((r) => ({
    time: r.cumulativeTime,
    attack: r.playerStats.attack,
    defense: r.playerStats.defense,
    lineHP: r.playerStats.lineHP,
  }));

  const lureRateData = rounds.map((r) => ({
    time: r.cumulativeTime,
    ...Object.fromEntries(
      Object.entries(r.lureRates).map(([id, rate]) => [id, rate]),
    ),
  }));

  const lureWinRateData = rounds.map((r) => ({
    time: r.cumulativeTime,
    ...Object.fromEntries(
      Object.entries(r.lureWinRates).map(([id, wr]) => [
        id,
        parseFloat((wr * 100).toFixed(2)),
      ]),
    ),
  }));

  const lureRemainingHPData = rounds.map((r) => ({
    time: r.cumulativeTime,
    ...Object.fromEntries(
      Object.entries(r.lureRemainingHP).map(([id, hp]) => [
        id,
        parseFloat(hp.toFixed(1)),
      ]),
    ),
  }));

  const levelData = rounds.map((r) => ({
    time: r.cumulativeTime,
    ...Object.fromEntries(
      nonLureUpgrades.map((u) => [u.id, r.upgradeLevels[u.id] ?? 0]),
    ),
  }));

  const lures = [
    { id: "", name: "No Lure" },
    ...shopData
      .filter((u) => u.stat === StatName.LURE)
      .map((u) => ({ id: u.id, name: u.id })),
  ];
  const lureColorMap = Object.fromEntries(
    lures.map((l, i) => [l.id, COLORS[i % COLORS.length]]),
  );
  const lureNameMap = Object.fromEntries(lures.map((l) => [l.id, l.name]));

  const fishColorMap = Object.fromEntries(
    fishData.map((f, i) => [f.id, COLORS[i % COLORS.length]]),
  );

  const lureShopMap = Object.fromEntries(
    shopData.filter((u) => u.stat === StatName.LURE).map((u) => [u.id, u]),
  );
  const lureRows: {
    name: string;
    cost: number;
    timeSincePrev: number | null;
  }[] = [];
  {
    let lastLureTime: number | null = null;
    for (const r of rounds) {
      if (!r.boughtLure) continue;
      for (const entry of r.upgradesBought) {
        const match = entry.match(/^(.+) L(\d+)$/);
        if (!match) continue;
        const [, id, levelStr] = match;
        const upgrade = lureShopMap[id];
        if (!upgrade) continue;
        const level = parseInt(levelStr, 10);
        const cost = upgrade.prices[level - 1];
        lureRows.push({
          name: upgrade.id,
          cost,
          timeSincePrev:
            lastLureTime !== null
              ? r.cumulativeTime - lastLureTime
              : r.cumulativeTime,
        });
        lastLureTime = r.cumulativeTime;
      }
    }
  }

  const lureRegions: { x1: number; x2: number; lureId: string }[] = [];
  if (rounds.length > 0) {
    let regionStart = 0;
    for (let i = 0; i < rounds.length; i++) {
      const r = rounds[i];
      if (i === rounds.length - 1 || rounds[i + 1].lureId !== r.lureId) {
        lureRegions.push({
          x1: regionStart,
          x2: r.cumulativeTime,
          lureId: r.lureId,
        });
        regionStart = r.cumulativeTime;
      }
    }
  }

  const lureRegionsByRound: { x1: number; x2: number; lureId: string }[] = [];
  if (rounds.length > 0) {
    let regionStart = rounds[0].round;
    for (let i = 0; i < rounds.length; i++) {
      const r = rounds[i];
      if (i === rounds.length - 1 || rounds[i + 1].lureId !== r.lureId) {
        lureRegionsByRound.push({
          x1: regionStart,
          x2: r.round,
          lureId: r.lureId,
        });
        regionStart = r.round;
      }
    }
  }

  const activeLureIds = [...new Set(rounds.map((r) => r.lureId))];

  const chartProps = { maxTime, xTicks };

  const lurePurchaseLines = rounds
    .filter((r) => r.boughtLure)
    .map((r) => (
      <ReferenceLine
        key={r.round}
        x={r.cumulativeTime}
        stroke="#4caf50"
        strokeDasharray="4 2"
      />
    ));

  const lurePurchaseLinesByRound = rounds
    .filter((r) => r.boughtLure)
    .map((r) => (
      <ReferenceLine
        key={r.round}
        x={r.round}
        stroke="#4caf50"
        strokeDasharray="4 2"
      />
    ));

  return (
    <Flex direction="column" gap="4" pt="4">
      <Flex gap="3" wrap="wrap" align="end">
        <NumInput
          label="Attack"
          value={reelStr}
          onChange={setReelStr}
          min={1}
        />
        <NumInput label="Defense" value={drag} onChange={setDrag} min={1} />
        <NumInput label="Line HP" value={lineHP} onChange={setLineHP} min={1} />
        <NumInput
          label="Inventory"
          value={inventorySize}
          onChange={setInventorySize}
          min={1}
        />
        <NumInput
          label="Sim minutes"
          value={simMinutes}
          onChange={setSimMinutes}
          min={1}
        />
        <Button onClick={runSim} disabled={running}>
          {running ? "Running…" : "Run Economy"}
        </Button>
        <GridToggleButton
          gridLayout={gridLayout}
          onToggle={() => setGridLayout((g) => !g)}
        />
      </Flex>

      {rounds.length > 0 && (
        <>
          <Text size="2" color="gray">
            {rounds.length} rounds simulated
          </Text>

          <ChartGrid gridLayout={gridLayout}>
            <EconomyChart
              title="Income Rate ($/s)"
              data={rateData}
              {...chartProps}
              header={activeLureIds.map((id) => (
                <Flex key={id} align="center" gap="1">
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 2,
                      backgroundColor: lureColorMap[id],
                      opacity: 0.8,
                    }}
                  />
                  <Text size="1" color="gray">
                    {lureNameMap[id]}
                  </Text>
                </Flex>
              ))}
            >
              {lureRegions.map((region, i) => (
                <ReferenceArea
                  key={i}
                  x1={region.x1}
                  x2={region.x2}
                  fill={lureColorMap[region.lureId]}
                  fillOpacity={0.12}
                  ifOverflow="hidden"
                />
              ))}
              {lurePurchaseLines}
              <Line dataKey="rate" stroke="#60cdff" {...lineProps} name="$/s" />
              <Line
                dataKey="upgrade"
                stroke="#ffd43b"
                dot={{ fill: "#ffd43b", r: 4 }}
                strokeWidth={0}
                isAnimationActive={false}
                name="upgrade"
              />
            </EconomyChart>

            <EconomyChart
              title="Income Rate ($/round)"
              data={ratePerRoundData}
              maxTime={maxTime}
              xDataKey="round"
              xDomain={[1, rounds.length]}
              xTickFormatter={(v) => `${v}`}
              syncId="economy-round"
              header={activeLureIds.map((id) => (
                <Flex key={id} align="center" gap="1">
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 2,
                      backgroundColor: lureColorMap[id],
                      opacity: 0.8,
                    }}
                  />
                  <Text size="1" color="gray">
                    {lureNameMap[id]}
                  </Text>
                </Flex>
              ))}
            >
              {lureRegionsByRound.map((region, i) => (
                <ReferenceArea
                  key={i}
                  x1={region.x1}
                  x2={region.x2}
                  fill={lureColorMap[region.lureId]}
                  fillOpacity={0.12}
                  ifOverflow="hidden"
                />
              ))}
              {lurePurchaseLinesByRound}
              <Line
                dataKey="income"
                stroke="#60cdff"
                {...lineProps}
                name="$/round"
              />
              <Line
                dataKey="upgrade"
                stroke="#ffd43b"
                dot={{ fill: "#ffd43b", r: 4 }}
                strokeWidth={0}
                isAnimationActive={false}
                name="upgrade"
              />
            </EconomyChart>

            <EconomyChart
              title="Lure Income Rates ($/s)"
              data={lureRateData}
              {...chartProps}
            >
              <Legend />
              {lures.map((l) => (
                <Line
                  key={l.id}
                  dataKey={l.id}
                  stroke={lureColorMap[l.id]}
                  {...lineProps}
                  name={l.name}
                  connectNulls={false}
                />
              ))}
            </EconomyChart>

            <EconomyChart
              title="Lure Win % by Lure"
              data={lureWinRateData}
              {...chartProps}
            >
              <Legend />
              {lures.map((l) => (
                <Line
                  key={l.id}
                  dataKey={l.id}
                  stroke={lureColorMap[l.id]}
                  {...lineProps}
                  name={l.name}
                  connectNulls={false}
                />
              ))}
            </EconomyChart>

            <EconomyChart
              title="Avg Remaining Line HP by Lure (%)"
              data={lureRemainingHPData}
              {...chartProps}
            >
              <Legend />
              {lures.map((l) => (
                <Line
                  key={l.id}
                  dataKey={l.id}
                  stroke={lureColorMap[l.id]}
                  {...lineProps}
                  name={l.name}
                  connectNulls={false}
                />
              ))}
            </EconomyChart>

            <EconomyChart
              title="Fish Income Rate ($)"
              data={earningsData}
              {...chartProps}
            >
              <Legend />
              {fishData.map((f) => (
                <Line
                  key={`${f.id}_earn`}
                  dataKey={`${f.id}_earn`}
                  stroke={fishColorMap[f.id]}
                  {...lineProps}
                  name={f.name}
                  connectNulls={false}
                />
              ))}
            </EconomyChart>

            <EconomyChart
              title="Catch Time (s)"
              data={catchTimeData}
              {...chartProps}
            >
              <Legend />
              {fishData.map((f) => (
                <Line
                  key={f.id}
                  dataKey={f.id}
                  stroke={fishColorMap[f.id]}
                  {...lineProps}
                  name={f.name}
                  connectNulls={false}
                />
              ))}
            </EconomyChart>

            <EconomyChart
              title="Player Stats"
              data={playerStatData}
              {...chartProps}
              integerYAxis
            >
              <Legend />
              <Line
                dataKey="attack"
                type="stepAfter"
                stroke="#ff6b6b"
                {...lineProps}
                name="Attack"
              />
              <Line
                dataKey="defense"
                type="stepAfter"
                stroke="#74c0fc"
                {...lineProps}
                name="Defense"
              />
              <Line
                dataKey="lineHP"
                type="stepAfter"
                stroke="#69db7c"
                {...lineProps}
                name="Line HP"
              />
            </EconomyChart>

            <EconomyChart
              title="Upgrade Levels"
              data={levelData}
              {...chartProps}
              integerYAxis
            >
              {lurePurchaseLines}
              <Legend />
              {nonLureUpgrades.map((u, i) => (
                <Line
                  key={u.id}
                  dataKey={u.id}
                  type="stepAfter"
                  stroke={COLORS[i % COLORS.length]}
                  {...lineProps}
                  name={u.id}
                />
              ))}
            </EconomyChart>

            {lureRows.length > 0 && (
              <Flex direction="column" gap="2">
                <Text size="2" weight="bold">
                  Lure Purchases
                </Text>
                <Table.Root variant="surface">
                  <Table.Header>
                    <Table.Row>
                      <Table.ColumnHeaderCell>Lure</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell>Cost ($)</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell>
                        Time Since Prev (s)
                      </Table.ColumnHeaderCell>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {lureRows.map((row, i) => (
                      <Table.Row key={i}>
                        <Table.Cell>{row.name}</Table.Cell>
                        <Table.Cell>{row.cost}</Table.Cell>
                        <Table.Cell>
                          {row.timeSincePrev !== null
                            ? Math.round(row.timeSincePrev)
                            : "—"}
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Root>
              </Flex>
            )}
          </ChartGrid>
        </>
      )}
    </Flex>
  );
}
