import React, { useState } from "react";
import { Flex, Text, Button } from "@radix-ui/themes";
import {
  ComposedChart,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  simulateEconomy,
  DEFAULT_SIM_PLAYER,
  type EconomyRound,
} from "../../game/EconomyModel";
import type { FishData, ShopUpgradeData } from "../../util/csvLoader";
import { COLORS, NumInput } from "./shared";

export function EconomyTab({
  fishData,
  shopData,
}: {
  fishData: FishData[];
  shopData: ShopUpgradeData[];
}) {
  const [reelStr, setReelStr] = useState(DEFAULT_SIM_PLAYER.attack);
  const [drag, setDrag] = useState(DEFAULT_SIM_PLAYER.defense);
  const [lineHP, setLineHP] = useState(DEFAULT_SIM_PLAYER.lineHP);
  const [rounds, setRounds] = useState<EconomyRound[]>([]);
  const [running, setRunning] = useState(false);

  const nonLureUpgrades = shopData.filter((u) => u.stat !== "lure");

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

  const levelData = rounds.map((r) => ({
    time: r.cumulativeTime,
    ...Object.fromEntries(
      nonLureUpgrades.map((u) => [u.id, r.upgradeLevels[u.id] ?? 0]),
    ),
  }));

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
      </Flex>

      {rounds.length > 0 && (
        <>
          <Text size="2" color="gray">
            {rounds.length} rounds simulated
          </Text>

          <Text size="2" weight="bold">
            Income Rate ($/s)
          </Text>
          <ResponsiveContainer width="100%" height={250}>
            <ComposedChart data={rateData} syncId="economy">
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="time" unit="s" />
              <YAxis />
              <Tooltip />
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

          <Text size="2" weight="bold">
            Upgrade Levels
          </Text>
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={levelData} syncId="economy">
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="time" unit="s" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
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
        </>
      )}
    </Flex>
  );
}
