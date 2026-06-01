import React, { useState, useEffect } from "react";
import { Flex, Text } from "@radix-ui/themes";
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { computeLureStats } from "../../game/EconomyModel";
import type {
  FishData,
  LocationFishEntry,
  ShopUpgradeData,
} from "../../util/csvLoader";
import { COLORS, NumInput } from "./shared";
import { INITIAL_PLAYER_STATE } from "../../stores/playerStore";

const lineProps = {
  dot: false as const,
  strokeWidth: 2,
  isAnimationActive: false,
};

export function GraphsTab({
  fishData,
  locationData,
}: {
  fishData: FishData[];
  shopData: ShopUpgradeData[];
  locationData: LocationFishEntry[];
}) {
  const [lineHP, setLineHP] = useState(INITIAL_PLAYER_STATE.lineHP);
  const [minStat, setMinStat] = useState(1);
  const [maxStat, setMaxStat] = useState(40);
  const [trialsPerFish, setTrialsPerFish] = useState(100);
  const [sweepData, setSweepData] = useState<object[]>([]);
  const [running, setRunning] = useState(false);

  const lureIds = [...new Set(fishData.map((f) => f.requiredLure))];
  const lureColors = Object.fromEntries(
    lureIds.map((id, i) => [id, COLORS[i % COLORS.length]]),
  );

  useEffect(() => {
    if (fishData.length === 0) return;
    setRunning(true);
    const id = setTimeout(() => {
      const data: object[] = [];
      const clampedMin = Math.min(minStat, maxStat);
      const clampedMax = Math.max(minStat, maxStat);

      for (let s = clampedMin; s <= clampedMax; s++) {
        const { rates, winRates } = computeLureStats(
          fishData,
          locationData,
          { attack: s, defense: s, lineHP, inventorySize: 3 },
          trialsPerFish,
        );
        const winRateKeyed = Object.fromEntries(
          Object.entries(winRates).map(([k, v]) => [`wr_${k}`, v]),
        );
        data.push({ stat: s, ...rates, ...winRateKeyed });
      }

      setSweepData(data);
      setRunning(false);
    }, 0);
    return () => clearTimeout(id);
  }, [fishData, locationData, lineHP, minStat, maxStat, trialsPerFish]);

  return (
    <Flex direction="column" gap="4" pt="4">
      <Flex gap="3" wrap="wrap" align="end">
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
          label="Trials/fish"
          value={trialsPerFish}
          onChange={setTrialsPerFish}
          min={1}
          max={1000}
        />
        {running && (
          <Text size="1" color="gray">
            Running…
          </Text>
        )}
      </Flex>

      {sweepData.length > 0 && (
        <>
          <Flex direction="column" gap="2">
            <Text size="2" weight="bold">
              Lure Income Rate vs Attack & Defense
            </Text>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={sweepData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis
                  dataKey="stat"
                  type="number"
                  label={{
                    value: "Attack / Defense",
                    position: "insideBottomRight",
                    offset: -4,
                    fontSize: 11,
                  }}
                />
                <YAxis
                  allowDecimals
                  // @ts-ignore
                  tickFormatter={(v: number) => +v.toFixed(2)}
                />
                <Tooltip
                  labelStyle={{ color: "#111" }}
                  // @ts-ignore
                  formatter={(v: number) => +v.toFixed(3)}
                  // @ts-ignore
                  labelFormatter={(v: number) => `Stat: ${v}`}
                />
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
              </ComposedChart>
            </ResponsiveContainer>
          </Flex>

          <Flex direction="column" gap="2">
            <Text size="2" weight="bold">
              Lure Win Rate vs Attack & Defense
            </Text>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={sweepData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis
                  dataKey="stat"
                  type="number"
                  label={{
                    value: "Attack / Defense",
                    position: "insideBottomRight",
                    offset: -4,
                    fontSize: 11,
                  }}
                />
                <YAxis
                  domain={[0, 1]}
                  tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
                />
                <Tooltip
                  labelStyle={{ color: "#111" }}
                  formatter={(v: number) => `${(v * 100).toFixed(1)}%`}
                  // @ts-ignore
                  labelFormatter={(v: number) => `Stat: ${v}`}
                />
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
              </ComposedChart>
            </ResponsiveContainer>
          </Flex>
        </>
      )}
    </Flex>
  );
}
