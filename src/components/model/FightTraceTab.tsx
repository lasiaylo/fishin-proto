import React, { useState, useEffect } from "react";
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
  ResponsiveContainer,
} from "recharts";
import {
  FightEngine,
  Phase,
  Outcome,
  DEFAULT_FIGHT_CONFIG,
  type FightConfig,
  type FrameRecord,
} from "../../game/FightEngine";
import type { FishData } from "../../util/csvLoader";
import { COLORS, NumInput, FishSelect, EngineConfigRow } from "./shared";
import { INITIAL_PLAYER_STATE } from "../../stores/playerStore";

interface FightResult {
  history: FrameRecord[];
  outcome: Outcome;
  duration: number;
}

function buildFightChartData(
  results: FightResult[],
): Array<Record<string, number | null>> {
  if (results.length === 0) return [];
  const maxLen = Math.max(...results.map((r) => r.history.length));
  return Array.from({ length: maxLen }, (_, i) => {
    const ref = results.find((r) => i < r.history.length)!;
    const entry: Record<string, number | null> = { time: ref.history[i].time };
    results.forEach((r, j) => {
      entry[`d${j}`] = i < r.history.length ? r.history[i].distance : null;
      entry[`t${j}`] = i < r.history.length ? r.history[i].tension : null;
    });
    return entry;
  });
}

function getPhaseSegments(
  history: FrameRecord[],
): Array<{ x1: number; x2: number; phase: Phase }> {
  if (history.length < 2) return [];
  const segments: Array<{ x1: number; x2: number; phase: Phase }> = [];
  let start = history[0].time;
  let current = history[0].phase;
  for (let i = 1; i < history.length; i++) {
    if (history[i].phase !== current) {
      segments.push({ x1: start, x2: history[i].time, phase: current });
      start = history[i].time;
      current = history[i].phase;
    }
  }
  segments.push({
    x1: start,
    x2: history[history.length - 1].time,
    phase: current,
  });
  return segments;
}

function phaseColor(phase: Phase): string {
  switch (phase) {
    case Phase.REST:
      return "rgba(0,255,0,0.08)";
    case Phase.STRUGGLE:
      return "rgba(255,0,0,0.12)";
    case Phase.SUPER_STRUGGLE:
      return "rgba(255,0,0,0.40)";
    case Phase.INIT_STRUGGLE:
      return "rgba(255,140,0,0.40)";
  }
}

export function FightTraceTab({ fishData }: { fishData: FishData[] }) {
  const [fishId, setFishId] = useState(fishData[0]?.id ?? "");
  const [fishSpeed, setFishSpeed] = useState(fishData[0]?.speed ?? 0);
  const [fishStrength, setFishStrength] = useState(fishData[0]?.strength ?? 0);
  const [fishBasePrice, setFishBasePrice] = useState(
    fishData[0]?.basePrice ?? 0,
  );
  const [reelStr, setReelStr] = useState(INITIAL_PLAYER_STATE.reelStrength);
  const [drag, setDrag] = useState(INITIAL_PLAYER_STATE.drag);
  const [lineHP, setLineHP] = useState(INITIAL_PLAYER_STATE.lineHP);
  const [trialCount, setTrialCount] = useState(1);
  const [engineCfg, setEngineCfg] = useState<FightConfig>(DEFAULT_FIGHT_CONFIG);
  const [results, setResults] = useState<FightResult[]>([]);

  useEffect(() => {
    const fish = fishData.find((f) => f.id === fishId);
    if (fish) {
      setFishSpeed(fish.speed);
      setFishStrength(fish.strength);
      setFishBasePrice(fish.basePrice);
    }
  }, [fishId, fishData]);

  function run() {
    const engine = new FightEngine(
      fishSpeed,
      fishStrength,
      reelStr,
      drag,
      lineHP,
      engineCfg,
    );
    const out: FightResult[] = [];
    for (let i = 0; i < trialCount; i++) {
      engine.reset();
      out.push(engine.runToCompletion(true));
    }
    setResults(out);
  }

  const chartData = buildFightChartData(results);
  const maxTime =
    chartData.length > 0 ? (chartData[chartData.length - 1].time as number) : 0;
  const xTicks = Array.from(
    { length: Math.floor(maxTime / 0.5) + 1 },
    (_, i) => +(i * 0.5).toFixed(1),
  );
  const single = results.length === 1;
  const segments = single ? getPhaseSegments(results[0].history) : [];
  const wins = results.filter((r) => r.outcome === Outcome.WIN).length;
  const avgDur = results.length
    ? results.reduce((s, r) => s + r.duration, 0) / results.length
    : 0;

  return (
    <Flex direction="column" gap="4" pt="4">
      <EngineConfigRow
        config={engineCfg}
        onChange={(patch) => setEngineCfg((c) => ({ ...c, ...patch }))}
      />
      <Flex gap="3" wrap="wrap" align="end">
        <FishSelect fishData={fishData} value={fishId} onChange={setFishId} />
        <NumInput
          label="Speed"
          value={fishSpeed}
          onChange={setFishSpeed}
          min={1}
        />
        <NumInput
          label="Strength"
          value={fishStrength}
          onChange={setFishStrength}
          min={1}
        />
        <NumInput
          label="Base Price"
          value={fishBasePrice}
          onChange={setFishBasePrice}
          min={0}
        />
      </Flex>
      <Flex gap="3" wrap="wrap" align="end">
        <NumInput label="Reel" value={reelStr} onChange={setReelStr} min={1} />
        <NumInput label="Drag" value={drag} onChange={setDrag} min={1} />
        <NumInput label="Line HP" value={lineHP} onChange={setLineHP} min={1} />
        <NumInput
          label="Trials"
          value={trialCount}
          onChange={setTrialCount}
          min={1}
          max={20}
        />
        <Button onClick={run}>Run</Button>
      </Flex>

      {results.length > 0 && (
        <>
          <Flex gap="4" align="center" wrap="wrap">
            <Text size="2" color="gray">
              {single
                ? `${results[0].outcome} · ${results[0].duration.toFixed(1)}s`
                : `${wins}/${results.length} wins (${((wins / results.length) * 100).toFixed(0)}%) · avg ${avgDur.toFixed(1)}s`}
            </Text>
            {single && (
              <Flex gap="3" align="center">
                {(
                  [
                    { phase: Phase.REST, label: "Rest" },
                    { phase: Phase.STRUGGLE, label: "Struggle" },
                    { phase: Phase.SUPER_STRUGGLE, label: "Super Struggle" },
                    { phase: Phase.INIT_STRUGGLE, label: "Init Struggle" },
                  ] as const
                ).map(({ phase, label }) => (
                  <Flex key={phase} gap="1" align="center">
                    <div
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: 2,
                        background: phaseColor(phase).replace(
                          /[\d.]+\)$/,
                          "0.7)",
                        ),
                      }}
                    />
                    <Text size="1" color="gray">
                      {label}
                    </Text>
                  </Flex>
                ))}
              </Flex>
            )}
          </Flex>

          <Text size="2" weight="bold">
            Line Distance
          </Text>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={chartData} syncId="fight">
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis
                dataKey="time"
                type="number"
                unit="s"
                ticks={xTicks}
                domain={["dataMin", "dataMax"]}
              />
              <YAxis domain={[0, 100]} />
              <Tooltip
                formatter={(v: number) => v.toFixed(2)}
                labelFormatter={(v: number) => `${v.toFixed(2)}s`}
                labelStyle={{ color: "#000" }}
              />
              {segments.map((seg, i) => (
                <ReferenceArea
                  key={i}
                  x1={seg.x1}
                  x2={seg.x2}
                  fill={phaseColor(seg.phase)}
                  strokeOpacity={0}
                />
              ))}
              <ReferenceLine y={0} stroke="#4caf50" strokeDasharray="4 2" />
              <ReferenceLine y={100} stroke="#f44336" strokeDasharray="4 2" />
              {results.map((_, i) => (
                <Line
                  key={i}
                  dataKey={`d${i}`}
                  stroke={COLORS[i % COLORS.length]}
                  dot={false}
                  strokeWidth={1.5}
                  connectNulls={false}
                  isAnimationActive={false}
                  name={`Trial ${i + 1}`}
                />
              ))}
            </ComposedChart>
          </ResponsiveContainer>

          <Text size="2" weight="bold">
            Line Tension
          </Text>
          <ResponsiveContainer width="100%" height={180}>
            <ComposedChart data={chartData} syncId="fight">
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis
                dataKey="time"
                type="number"
                unit="s"
                ticks={xTicks}
                domain={["dataMin", "dataMax"]}
              />
              <YAxis />
              <Tooltip
                formatter={(v: number) => v.toFixed(2)}
                labelFormatter={(v: number) => `${v.toFixed(2)}s`}
                labelStyle={{ color: "#000" }}
              />
              <ReferenceLine
                y={lineHP}
                stroke="#f44336"
                strokeDasharray="4 2"
                label={{ value: "break", fill: "#f44336", fontSize: 11 }}
              />
              {results.map((_, i) => (
                <Line
                  key={i}
                  dataKey={`t${i}`}
                  stroke={COLORS[i % COLORS.length]}
                  dot={false}
                  strokeWidth={1.5}
                  connectNulls={false}
                  isAnimationActive={false}
                  name={`Trial ${i + 1}`}
                />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        </>
      )}
    </Flex>
  );
}
