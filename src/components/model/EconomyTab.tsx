import React, { useState } from "react";
import { Flex, Text, Button } from "@radix-ui/themes";
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
import type { FishData, ShopUpgradeData } from "../../util/csvLoader";
import { COLORS, NumInput } from "./shared";
import { INITIAL_PLAYER_STATE } from "../../stores/playerStore";

export function EconomyTab({
  fishData,
  shopData,
}: {
  fishData: FishData[];
  shopData: ShopUpgradeData[];
}) {
  const [reelStr, setReelStr] = useState(INITIAL_PLAYER_STATE.attack);
  const [drag, setDrag] = useState(INITIAL_PLAYER_STATE.defense);
  const [lineHP, setLineHP] = useState(INITIAL_PLAYER_STATE.lineHP);
  const [rounds, setRounds] = useState<EconomyRound[]>([]);
  const [running, setRunning] = useState(false);
  const [gridLayout, setGridLayout] = useState(true);

  const nonLureUpgrades = shopData.filter((u) => u.stat !== StatName.LURE);

  function runSim() {
    setRunning(true);
    setTimeout(() => {
      setRounds(
        simulateEconomy(fishData, shopData, {
          attack: reelStr,
          defense: drag,
          lineHP,
        }),
      );
      setRunning(false);
    }, 0);
  }

  const rateData = rounds.map((r) => ({
    time: r.cumulativeTime,
    rate: parseFloat(r.rate.toFixed(4)),
    upgrade: r.upgradesBought.length > 0 ? parseFloat(r.rate.toFixed(4)) : null,
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

  const walletData = rounds.map((r) => ({
    time: r.cumulativeTime,
    wallet: r.wallet,
  }));

  const levelData = rounds.map((r) => ({
    time: r.cumulativeTime,
    ...Object.fromEntries(
      nonLureUpgrades.map((u) => [u.id, r.upgradeLevels[u.id] ?? 0]),
    ),
  }));

  const fishColorMap = Object.fromEntries(
    fishData.map((f, i) => [f.id, COLORS[i % COLORS.length]]),
  );
  const fishNameMap = Object.fromEntries(fishData.map((f) => [f.id, f.name]));

  const fishRegions: { x1: number; x2: number; fishId: string }[] = [];
  if (rounds.length > 0) {
    let regionStart = 0;
    for (let i = 0; i < rounds.length; i++) {
      const r = rounds[i];
      if (i === rounds.length - 1 || rounds[i + 1].fishId !== r.fishId) {
        fishRegions.push({
          x1: regionStart,
          x2: r.cumulativeTime,
          fishId: r.fishId,
        });
        regionStart = r.cumulativeTime;
      }
    }
  }

  const activeFishIds = [...new Set(rounds.map((r) => r.fishId))];

  const tooltipProps = {
    labelStyle: { color: "#111" },
    formatter: (v: number) => (typeof v === "number" ? +v.toFixed(2) : v),
    labelFormatter: (label: number) => +Number(label).toFixed(2),
  };

  // @ts-ignore
  // @ts-ignore
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
        <Button onClick={runSim} disabled={running}>
          {running ? "Running…" : "Run Economy"}
        </Button>
        <Button variant="soft" onClick={() => setGridLayout((g) => !g)}>
          {gridLayout ? "List" : "Grid"}
        </Button>
      </Flex>

      {rounds.length > 0 && (
        <>
          <Text size="2" color="gray">
            {rounds.length} rounds simulated
          </Text>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: gridLayout ? "1fr 1fr" : "1fr",
              gap: 16,
            }}
          >
            <Flex direction="column" gap="2">
              <Flex align="center" gap="4" wrap="wrap">
                <Text size="2" weight="bold">
                  Income Rate ($/s)
                </Text>
                {activeFishIds.map((id) => (
                  <Flex key={id} align="center" gap="1">
                    <div
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 2,
                        backgroundColor: fishColorMap[id],
                        opacity: 0.8,
                      }}
                    />
                    <Text size="1" color="gray">
                      {fishNameMap[id]}
                    </Text>
                  </Flex>
                ))}
              </Flex>
              <ResponsiveContainer width="100%" height={200}>
                <ComposedChart data={rateData} syncId="economy">
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  {fishRegions.map((region, i) => (
                    <ReferenceArea
                      key={i}
                      x1={region.x1}
                      x2={region.x2}
                      fill={fishColorMap[region.fishId]}
                      fillOpacity={0.12}
                      ifOverflow="hidden"
                    />
                  ))}
                  <XAxis
                    dataKey="time"
                    type="number"
                    domain={[0, maxTime]}
                    ticks={xTicks}
                    tickFormatter={(v: number) => `${v / 60}`}
                  />
                  <YAxis />
                  {/* @ts-ignore */}
                  <Tooltip {...tooltipProps} />
                  {rounds
                    .filter((r) => r.boughtLure)
                    .map((r) => (
                      <ReferenceLine
                        key={r.round}
                        x={r.cumulativeTime}
                        stroke="#4caf50"
                        strokeDasharray="4 2"
                        label={{ value: "lure", fill: "#4caf50", fontSize: 10 }}
                      />
                    ))}
                  <Line
                    dataKey="rate"
                    stroke="#60cdff"
                    dot={false}
                    strokeWidth={2}
                    isAnimationActive={false}
                    name="$/s"
                  />
                  <Line
                    dataKey="upgrade"
                    stroke="#ffd43b"
                    dot={{ fill: "#ffd43b", r: 4 }}
                    strokeWidth={0}
                    isAnimationActive={false}
                    name="upgrade"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </Flex>

            <Flex direction="column" gap="2">
              <Text size="2" weight="bold">
                Avg Catch Time (s)
              </Text>
              <ResponsiveContainer width="100%" height={200}>
                <ComposedChart data={catchTimeData} syncId="economy">
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis
                    dataKey="time"
                    type="number"
                    domain={[0, maxTime]}
                    ticks={xTicks}
                    tickFormatter={(v: number) => `${v / 60}`}
                  />
                  <YAxis />
                  {/* @ts-ignore */}
                  <Tooltip {...tooltipProps} />
                  <Legend />
                  {fishData.map((f) => (
                    <Line
                      key={f.id}
                      dataKey={f.id}
                      stroke={fishColorMap[f.id]}
                      dot={false}
                      strokeWidth={2}
                      isAnimationActive={false}
                      name={f.name}
                      connectNulls={false}
                    />
                  ))}
                </ComposedChart>
              </ResponsiveContainer>
            </Flex>

            <Flex direction="column" gap="2">
              <Text size="2" weight="bold">
                Upgrade Levels
              </Text>
              <ResponsiveContainer width="100%" height={200}>
                <ComposedChart data={levelData} syncId="economy">
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis
                    dataKey="time"
                    type="number"
                    domain={[0, maxTime]}
                    ticks={xTicks}
                    tickFormatter={(v: number) => `${v / 60}`}
                  />
                  <YAxis allowDecimals={false} />
                  {/* @ts-ignore */}
                  <Tooltip {...tooltipProps} />
                  <Legend />
                  {rounds
                    .filter((r) => r.boughtLure)
                    .map((r) => (
                      <ReferenceLine
                        key={r.round}
                        x={r.cumulativeTime}
                        stroke="#4caf50"
                        strokeDasharray="4 2"
                        label={{ value: "lure", fill: "#4caf50", fontSize: 10 }}
                      />
                    ))}
                  {nonLureUpgrades.map((u, i) => (
                    <Line
                      key={u.id}
                      dataKey={u.id}
                      type="stepAfter"
                      stroke={COLORS[i % COLORS.length]}
                      dot={false}
                      strokeWidth={2}
                      isAnimationActive={false}
                      name={u.name}
                    />
                  ))}
                </ComposedChart>
              </ResponsiveContainer>
            </Flex>

            <Flex direction="column" gap="2">
              <Text size="2" weight="bold">
                Wallet ($)
              </Text>
              <ResponsiveContainer width="100%" height={200}>
                <ComposedChart data={walletData} syncId="economy">
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis
                    dataKey="time"
                    type="number"
                    domain={[0, maxTime]}
                    ticks={xTicks}
                    tickFormatter={(v: number) => `${v / 60}`}
                  />
                  <YAxis />
                  {/* @ts-ignore */}
                  <Tooltip {...tooltipProps} />
                  {rounds
                    .filter((r) => r.boughtLure)
                    .map((r) => (
                      <ReferenceLine
                        key={r.round}
                        x={r.cumulativeTime}
                        stroke="#4caf50"
                        strokeDasharray="4 2"
                        label={{ value: "lure", fill: "#4caf50", fontSize: 10 }}
                      />
                    ))}
                  <Line
                    dataKey="wallet"
                    stroke="#ff922b"
                    dot={false}
                    strokeWidth={2}
                    isAnimationActive={false}
                    name="wallet"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </Flex>
          </div>
        </>
      )}
    </Flex>
  );
}
