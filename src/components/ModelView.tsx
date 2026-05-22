import "@radix-ui/themes/styles.css";
import React, {
  Fragment,
  useState,
  useEffect,
  type CSSProperties,
} from "react";
import { Theme, Tabs, Flex, Text, Button } from "@radix-ui/themes";
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
import { FightEngine, Phase, type FrameRecord } from "../game/FightEngine";
import {
  simulateEconomy,
  DEFAULT_SIM_PLAYER,
  type EconomyRound,
} from "../game/EconomyModel";
import {
  loadFishData,
  loadShopData,
  type FishData,
  type ShopUpgradeData,
} from "../util/csvLoader";

// ── Constants ──

const COLORS = [
  "#60cdff",
  "#ff6b6b",
  "#69db7c",
  "#ffd43b",
  "#da77f2",
  "#74c0fc",
  "#ff922b",
  "#a9e34b",
];

// ── Local types ──

interface FightResult {
  history: FrameRecord[];
  outcome: string;
  duration: number;
}

interface SweepCell {
  reel: number;
  drag: number;
  winPct: number;
  avgTime: number;
}

// ── Pure helpers ──

function buildFightChartData(
  results: FightResult[],
): Array<Record<string, number | null>> {
  if (results.length === 0) return [];
  const maxLen = Math.max(...results.map((r) => r.history.length));
  return Array.from({ length: maxLen }, (_, i) => {
    const entry: Record<string, number | null> = { time: i * 0.5 };
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
  }
}

function winPctToColor(pct: number): string {
  return `hsl(${pct * 1.2}, 70%, 35%)`;
}

function avgTimeToColor(t: number): string {
  return `hsl(${240 - Math.min(t / 60, 1) * 240}, 60%, 40%)`;
}

// ── Shared control ──

function NumInput({
  label,
  value,
  onChange,
  min = 0,
  max = 999,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <Text size="1" color="gray">
        {label}
      </Text>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: 68 }}
      />
    </label>
  );
}

function FishSelect({
  fishData,
  value,
  onChange,
}: {
  fishData: FishData[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <Text size="1" color="gray">
        Fish
      </Text>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {fishData.map((f) => (
          <option key={f.id} value={f.id}>
            {f.name}
          </option>
        ))}
      </select>
    </label>
  );
}

// ── Root ──

export function ModelView() {
  const [fishData, setFishData] = useState<FishData[]>([]);
  const [shopData, setShopData] = useState<ShopUpgradeData[]>([]);

  useEffect(() => {
    Promise.all([loadFishData(), loadShopData()]).then(([fish, shop]) => {
      setFishData(fish);
      setShopData(shop);
    });
  }, []);

  return (
    <Theme appearance="dark" accentColor="cyan" grayColor="mauve">
      <Flex direction="column" p="4" gap="4" style={{ minHeight: "100vh" }}>
        <Text size="6" weight="bold">
          Model
        </Text>
        {fishData.length === 0 ? (
          <Text color="gray">Loading data…</Text>
        ) : (
          <Tabs.Root defaultValue="fight">
            <Tabs.List>
              <Tabs.Trigger value="fight">Fight Trace</Tabs.Trigger>
              <Tabs.Trigger value="sweep">Parameter Sweep</Tabs.Trigger>
              <Tabs.Trigger value="economy">Economy</Tabs.Trigger>
            </Tabs.List>
            <Tabs.Content value="fight">
              <FightTraceTab fishData={fishData} />
            </Tabs.Content>
            <Tabs.Content value="sweep">
              <ParamSweepTab fishData={fishData} />
            </Tabs.Content>
            <Tabs.Content value="economy">
              <EconomyTab fishData={fishData} shopData={shopData} />
            </Tabs.Content>
          </Tabs.Root>
        )}
      </Flex>
    </Theme>
  );
}

// ── Fight Trace ──

function FightTraceTab({ fishData }: { fishData: FishData[] }) {
  const [fishId, setFishId] = useState(fishData[0]?.id ?? "");
  const [fishSpeed, setFishSpeed] = useState(fishData[0]?.speed ?? 0);
  const [fishStrength, setFishStrength] = useState(fishData[0]?.strength ?? 0);
  const [fishBasePrice, setFishBasePrice] = useState(
    fishData[0]?.basePrice ?? 0,
  );
  const [reelStr, setReelStr] = useState(3);
  const [drag, setDrag] = useState(3);
  const [lineHP, setLineHP] = useState(20);
  const [trialCount, setTrialCount] = useState(1);
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
    );
    const out: FightResult[] = [];
    for (let i = 0; i < trialCount; i++) {
      engine.reset();
      out.push(engine.runToCompletion(true));
    }
    setResults(out);
  }

  const chartData = buildFightChartData(results);
  const single = results.length === 1;
  const segments = single ? getPhaseSegments(results[0].history) : [];
  const wins = results.filter((r) => r.outcome === "WIN").length;
  const avgDur = results.length
    ? results.reduce((s, r) => s + r.duration, 0) / results.length
    : 0;

  return (
    <Flex direction="column" gap="4" pt="4">
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
          <Text size="2" color="gray">
            {single
              ? `${results[0].outcome} · ${results[0].duration.toFixed(1)}s`
              : `${wins}/${results.length} wins (${((wins / results.length) * 100).toFixed(0)}%) · avg ${avgDur.toFixed(1)}s`}
          </Text>

          <Text size="2" weight="bold">
            Line Distance
          </Text>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={chartData} syncId="fight">
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="time" unit="s" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
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
              <XAxis dataKey="time" unit="s" />
              <YAxis />
              <Tooltip />
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

// ── Parameter Sweep ──

function ParamSweepTab({ fishData }: { fishData: FishData[] }) {
  const [fishId, setFishId] = useState(fishData[0]?.id ?? "");
  const [fishSpeed, setFishSpeed] = useState(fishData[0]?.speed ?? 0);
  const [fishStrength, setFishStrength] = useState(fishData[0]?.strength ?? 0);
  const [fishBasePrice, setFishBasePrice] = useState(
    fishData[0]?.basePrice ?? 0,
  );
  const [lineHP, setLineHP] = useState(20);
  const [reelMin, setReelMin] = useState(1);
  const [reelMax, setReelMax] = useState(8);
  const [dragMin, setDragMin] = useState(1);
  const [dragMax, setDragMax] = useState(8);
  const [trialsPerCell, setTrialsPerCell] = useState(100);
  const [cells, setCells] = useState<SweepCell[]>([]);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    const fish = fishData.find((f) => f.id === fishId);
    if (fish) {
      setFishSpeed(fish.speed);
      setFishStrength(fish.strength);
      setFishBasePrice(fish.basePrice);
    }
  }, [fishId, fishData]);

  function runSweep() {
    setRunning(true);
    setTimeout(() => {
      const result: SweepCell[] = [];
      for (let reel = reelMin; reel <= reelMax; reel++) {
        for (let drag = dragMin; drag <= dragMax; drag++) {
          const engine = new FightEngine(
            fishSpeed,
            fishStrength,
            reel,
            drag,
            lineHP,
          );
          let wins = 0,
            totalTime = 0;
          for (let t = 0; t < trialsPerCell; t++) {
            engine.reset();
            const { outcome, duration } = engine.runToCompletion();
            if (outcome === "WIN") {
              wins++;
              totalTime += duration;
            }
          }
          result.push({
            reel,
            drag,
            winPct: (wins / trialsPerCell) * 100,
            avgTime: wins > 0 ? totalTime / wins : 120,
          });
        }
      }
      setCells(result);
      setRunning(false);
    }, 0);
  }

  const reelVals = Array.from(
    { length: Math.max(0, reelMax - reelMin + 1) },
    (_, i) => reelMin + i,
  );
  const dragVals = Array.from(
    { length: Math.max(0, dragMax - dragMin + 1) },
    (_, i) => dragMin + i,
  );

  return (
    <Flex direction="column" gap="4" pt="4">
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
        <NumInput label="Line HP" value={lineHP} onChange={setLineHP} min={1} />
        <NumInput
          label="Reel Min"
          value={reelMin}
          onChange={setReelMin}
          min={1}
        />
        <NumInput
          label="Reel Max"
          value={reelMax}
          onChange={setReelMax}
          min={1}
        />
        <NumInput
          label="Drag Min"
          value={dragMin}
          onChange={setDragMin}
          min={1}
        />
        <NumInput
          label="Drag Max"
          value={dragMax}
          onChange={setDragMax}
          min={1}
        />
        <NumInput
          label="Trials/Cell"
          value={trialsPerCell}
          onChange={setTrialsPerCell}
          min={10}
          max={500}
        />
        <Button onClick={runSweep} disabled={running}>
          {running ? "Running…" : "Run Sweep"}
        </Button>
      </Flex>

      {cells.length > 0 && (
        <Flex gap="8" wrap="wrap" pt="2">
          <Heatmap
            title="Win %"
            reelVals={reelVals}
            dragVals={dragVals}
            cells={cells}
            getValue={(c) => c.winPct}
            format={(v) => `${v.toFixed(0)}%`}
            toColor={winPctToColor}
            lowBorder={(v) => v < 25}
          />
          <Heatmap
            title="Avg Fight Time (s)"
            reelVals={reelVals}
            dragVals={dragVals}
            cells={cells}
            getValue={(c) => c.avgTime}
            format={(v) => (v >= 120 ? "—" : v.toFixed(1))}
            toColor={avgTimeToColor}
          />
        </Flex>
      )}
    </Flex>
  );
}

function Heatmap({
  title,
  reelVals,
  dragVals,
  cells,
  getValue,
  format,
  toColor,
  lowBorder,
}: {
  title: string;
  reelVals: number[];
  dragVals: number[];
  cells: SweepCell[];
  getValue: (c: SweepCell) => number;
  format: (v: number) => string;
  toColor: (v: number) => string;
  lowBorder?: (v: number) => boolean;
}) {
  const hdr: CSSProperties = {
    fontSize: 11,
    color: "#999",
    padding: "3px 6px",
    textAlign: "center",
  };
  return (
    <Flex direction="column" gap="2">
      <Text size="2" weight="bold">
        {title}
      </Text>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `36px repeat(${dragVals.length}, 52px)`,
          gap: 2,
        }}
      >
        <div style={hdr}>r\d</div>
        {dragVals.map((d) => (
          <div key={d} style={hdr}>
            {d}
          </div>
        ))}
        {reelVals.map((r) => (
          <Fragment key={r}>
            <div
              style={{
                ...hdr,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {r}
            </div>
            {dragVals.map((d) => {
              const cell = cells.find((c) => c.reel === r && c.drag === d);
              const v = cell ? getValue(cell) : 0;
              return (
                <div
                  key={d}
                  style={{
                    background: cell ? toColor(v) : "#222",
                    border:
                      cell && lowBorder?.(v)
                        ? "2px dashed #f44336"
                        : "1px solid #2a2a2a",
                    borderRadius: 3,
                    height: 36,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    color: "white",
                  }}
                >
                  {cell ? format(v) : ""}
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>
    </Flex>
  );
}

// ── Economy ──

function EconomyTab({
  fishData,
  shopData,
}: {
  fishData: FishData[];
  shopData: ShopUpgradeData[];
}) {
  const [reelStr, setReelStr] = useState(DEFAULT_SIM_PLAYER.reelStrength);
  const [drag, setDrag] = useState(DEFAULT_SIM_PLAYER.drag);
  const [lineHP, setLineHP] = useState(DEFAULT_SIM_PLAYER.lineHP);
  const [rounds, setRounds] = useState<EconomyRound[]>([]);
  const [running, setRunning] = useState(false);

  const nonLureUpgrades = shopData.filter((u) => u.stat !== "lure");

  function runSim() {
    setRunning(true);
    setTimeout(() => {
      setRounds(
        simulateEconomy(fishData, shopData, {
          reelStrength: reelStr,
          drag,
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
        <NumInput label="Reel" value={reelStr} onChange={setReelStr} min={1} />
        <NumInput label="Drag" value={drag} onChange={setDrag} min={1} />
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
