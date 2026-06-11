import React, {
  Fragment,
  useState,
  useEffect,
  useRef,
  type CSSProperties,
} from "react";
import { Flex, Text, Button, Table } from "@radix-ui/themes";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import {
  FightEngine,
  Outcome,
  DEFAULT_FIGHT_CONFIG,
  MAX_SIM_TIME,
  type FightConfig,
} from "../../game/FightEngine";
import type { FishData } from "../../util/csvLoader";
import { avgZoneDistance } from "../../util/csvLoader";
import { NumInput, FishSelect, EngineConfigRow } from "./shared";

interface SweepCell {
  reel: number;
  drag: number;
  winPct: number;
  avgTime: number;
  avgRemainingHP: number;
}

function winPctToColor(pct: number): string {
  return `hsl(${pct * 1.2}, 70%, 35%)`;
}

function avgTimeToColor(t: number): string {
  return `hsl(${240 - Math.min(t / 60, 1) * 240}, 60%, 40%)`;
}

function remainingHPToColor(pct: number): string {
  return `hsl(${pct * 1.2}, 70%, 35%)`;
}

function SweepSummaryTable({
  cells,
  fishAtk,
}: {
  cells: SweepCell[];
  fishAtk: number;
}) {
  const breakpoints = [
    { label: "½×", ad: Math.max(1, Math.round(fishAtk * 0.5)) },
    { label: "¾×", ad: Math.max(1, Math.round(fishAtk * 0.75)) },
    { label: "1×", ad: fishAtk },
    { label: "1¼×", ad: Math.round(fishAtk * 1.25) },
    { label: "2×", ad: Math.round(fishAtk * 2) },
  ];

  return (
    <Table.Root variant="surface" size="1">
      <Table.Header>
        <Table.Row>
          <Table.ColumnHeaderCell>A/D</Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell>Win %</Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell>Fight Time</Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell>Remaining HP %</Table.ColumnHeaderCell>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {breakpoints.map(({ label, ad }) => {
          const cell = cells.find((c) => c.reel === ad && c.drag === ad);
          return (
            <Table.Row key={label}>
              <Table.Cell>
                {label} ({ad})
              </Table.Cell>
              <Table.Cell>
                {cell ? `${cell.winPct.toFixed(1)}%` : "—"}
              </Table.Cell>
              <Table.Cell>
                {cell ? `${cell.avgTime.toFixed(1)}s` : "—"}
              </Table.Cell>
              <Table.Cell>
                {cell ? `${cell.avgRemainingHP.toFixed(1)}%` : "—"}
              </Table.Cell>
            </Table.Row>
          );
        })}
      </Table.Body>
    </Table.Root>
  );
}

function DeltaLineChart({
  reelMin,
  reelMax,
  fishAtk,
  fishDef,
  engineCfg,
}: {
  reelMin: number;
  reelMax: number;
  fishAtk: number;
  fishDef: number;
  engineCfg: FightConfig;
}) {
  if (reelMax < reelMin) return null;
  const avgFightDur =
    (engineCfg.fightTimeRange[0] + engineCfg.fightTimeRange[1]) / 2;
  const avgRestDur =
    (engineCfg.restTimeRange[0] + engineCfg.restTimeRange[1]) / 2;
  const totalDur = avgFightDur + avgRestDur;
  const data = Array.from({ length: reelMax - reelMin + 1 }, (_, i) => {
    const ad = reelMin + i;
    const struggling = parseFloat(
      FightEngine.computeDelta(fishAtk, ad, engineCfg).toFixed(2),
    );
    const resting = parseFloat(
      FightEngine.computeDelta(ad, fishDef, engineCfg).toFixed(2),
    );
    const netAvg = parseFloat(
      ((struggling * avgFightDur - resting * avgRestDur) / totalDur).toFixed(2),
    );
    return { ad, struggling, resting, netAvg };
  });

  return (
    <Flex direction="column" gap="2">
      <Text size="2" weight="bold">
        Fight Deltas
      </Text>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart
          data={data}
          margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis
            dataKey="ad"
            label={{
              value: "A/D",
              position: "insideBottomRight",
              offset: -4,
              fill: "#999",
              fontSize: 11,
            }}
            tick={{ fill: "#999", fontSize: 11 }}
          />
          <YAxis tick={{ fill: "#999", fontSize: 11 }} width={42} />
          <Tooltip
            contentStyle={{
              background: "#1a1a1a",
              border: "1px solid #333",
              fontSize: 12,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line
            type="monotone"
            dataKey="struggling"
            name="Struggling"
            stroke="#f44336"
            dot={false}
            strokeWidth={2}
          />
          <Line
            type="monotone"
            dataKey="resting"
            name="Resting"
            stroke="#4caf50"
            dot={false}
            strokeWidth={2}
          />
          <Line
            type="monotone"
            dataKey="netAvg"
            name="Net Avg"
            stroke="#ce93d8"
            dot={false}
            strokeWidth={2}
            strokeDasharray="5 3"
          />
          {[0.5, 0.75, 1, 1.25].map((mult) => (
            <ReferenceLine
              key={mult}
              x={Math.round(fishAtk * mult)}
              stroke="#f9a825"
              strokeDasharray="4 3"
              label={{
                value: `${mult}×`,
                fill: "#f9a825",
                fontSize: 10,
                position: "insideTopRight",
              }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </Flex>
  );
}

function DiagonalLineChart({
  cells,
  fishAtk,
}: {
  cells: SweepCell[];
  fishAtk: number;
}) {
  const data = cells
    .filter((c) => c.reel === c.drag)
    .sort((a, b) => a.reel - b.reel)
    .map((c) => ({
      ad: c.reel,
      winPct: parseFloat(c.winPct.toFixed(1)),
      remainingHP: parseFloat(c.avgRemainingHP.toFixed(1)),
      avgTime: parseFloat(c.avgTime.toFixed(1)),
    }));

  if (data.length < 2) return null;

  return (
    <Flex direction="column" gap="2">
      <Text size="2" weight="bold">
        Fight Stats
      </Text>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart
          data={data}
          margin={{ top: 4, right: 48, left: 0, bottom: 4 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis
            dataKey="ad"
            label={{
              value: "A/D",
              position: "insideBottomRight",
              offset: -4,
              fill: "#999",
              fontSize: 11,
            }}
            tick={{ fill: "#999", fontSize: 11 }}
          />
          <YAxis
            yAxisId="pct"
            domain={[0, 100]}
            tickFormatter={(v) => `${v}%`}
            tick={{ fill: "#999", fontSize: 11 }}
            width={42}
          />
          <YAxis
            yAxisId="time"
            orientation="right"
            tickFormatter={(v) => `${v}s`}
            tick={{ fill: "#f9a825", fontSize: 11 }}
            width={42}
          />
          <Tooltip
            formatter={(v: number, name: string) =>
              name === "Avg Fight Time (s)" ? [`${v}s`, name] : [`${v}%`, name]
            }
            contentStyle={{
              background: "#1a1a1a",
              border: "1px solid #333",
              fontSize: 12,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line
            yAxisId="pct"
            type="monotone"
            dataKey="winPct"
            name="Win %"
            stroke="#4caf50"
            dot={false}
            strokeWidth={2}
          />
          <Line
            yAxisId="pct"
            type="monotone"
            dataKey="remainingHP"
            name="Remaining Line HP %"
            stroke="#2196f3"
            dot={false}
            strokeWidth={2}
          />
          <Line
            yAxisId="time"
            type="monotone"
            dataKey="avgTime"
            name="Avg Fight Time (s)"
            stroke="#f9a825"
            dot={false}
            strokeWidth={2}
          />
          {[0.5, 0.75, 1, 1.25].map((mult) => (
            <ReferenceLine
              key={mult}
              yAxisId="pct"
              x={Math.round(fishAtk * mult)}
              stroke="#f9a825"
              strokeDasharray="4 3"
              label={{
                value: `${mult}×`,
                fill: "#f9a825",
                fontSize: 10,
                position: "insideTopRight",
              }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
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
  fishAD,
}: {
  title: string;
  reelVals: number[];
  dragVals: number[];
  cells: SweepCell[];
  getValue: (c: SweepCell) => number;
  format: (v: number) => string;
  toColor: (v: number) => string;
  fishAD?: number;
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
          gridTemplateColumns: `36px repeat(${dragVals.length}, 36px)`,
          gap: 2,
        }}
      >
        <div style={hdr}>A\D</div>
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
                    boxSizing: "border-box",
                    border: r === d ? "2px solid #888" : "1px solid #2a2a2a",
                    outline:
                      r === fishAD && d === fishAD
                        ? "2px solid #fff"
                        : undefined,
                    borderRadius: 3,
                    width: 36,
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

export function ParamSweepTab({ fishData }: { fishData: FishData[] }) {
  const [fishId, setFishId] = useState(() => {
    const stored = localStorage.getItem("debug_selectedFishId");
    if (stored && fishData.some((f) => f.id === stored)) return stored;
    return fishData[0]?.id ?? "";
  });
  const [fishSpeed, setFishSpeed] = useState(fishData[0]?.attack ?? 0);
  const [fishStrength, setFishStrength] = useState(fishData[0]?.defense ?? 0);
  const [fishThrash, setFishThrash] = useState(fishData[0]?.thrash ?? 0);
  const [fishBasePrice, setFishBasePrice] = useState(
    fishData[0]?.basePrice ?? 0,
  );
  const [fishStartingDistance, setFishStartingDistance] = useState(
    fishData[0]?.startingDistance ?? 0,
  );
  const [fishStartDistance, setFishStartDistance] = useState(
    avgZoneDistance(fishData[0]?.zones ?? []),
  );
  const [lineHP, setLineHP] = useState(15);
  const [reelMin, setReelMin] = useState(
    Math.max(1, Math.round((fishData[0]?.attack ?? 2) / 2)),
  );
  const [reelMax, setReelMax] = useState(
    Math.round((fishData[0]?.attack ?? 2) * 2),
  );
  const dragMin = reelMin;
  const dragMax = reelMax;
  const [trialsPerCell, setTrialsPerCell] = useState(200);
  const [engineCfg, setEngineCfg] = useState<FightConfig>(DEFAULT_FIGHT_CONFIG);
  const [cells, setCells] = useState<SweepCell[]>([]);
  const [running, setRunning] = useState(false);
  const cancelRef = useRef(false);

  useEffect(() => {
    localStorage.setItem("debug_selectedFishId", fishId);
  }, [fishId]);

  useEffect(() => {
    const fish = fishData.find((f) => f.id === fishId);
    if (fish) {
      setFishSpeed(fish.attack);
      setFishStrength(fish.defense);
      setFishThrash(fish.thrash);
      setFishBasePrice(fish.basePrice);
      setFishStartingDistance(fish.startingDistance);
      setFishStartDistance(avgZoneDistance(fish.zones));
      setReelMin(Math.max(1, Math.round(fish.attack / 2)));
      setReelMax(Math.round(fish.attack * 2));
    }
  }, [fishId, fishData]);

  async function runSweep() {
    cancelRef.current = false;
    setRunning(true);
    setCells([]);

    const pairs: { reel: number; drag: number }[] = [];
    for (let reel = reelMin; reel <= reelMax; reel++)
      for (let drag = dragMin; drag <= dragMax; drag++)
        pairs.push({ reel, drag });

    const acc = new Map(
      pairs.map(({ reel, drag }) => [
        `${reel}-${drag}`,
        { wins: 0, totalTime: 0, totalRemainingHP: 0 },
      ]),
    );
    const engines = new Map(
      pairs.map(({ reel, drag }) => [
        `${reel}-${drag}`,
        new FightEngine(
          fishSpeed,
          fishStrength,
          fishThrash,
          reel,
          drag,
          lineHP,
          fishStartDistance,
          fishStartingDistance,
          engineCfg,
        ),
      ]),
    );

    for (let t = 0; t < trialsPerCell; t++) {
      if (cancelRef.current) break;

      for (const { reel, drag } of pairs) {
        const key = `${reel}-${drag}`;
        const engine = engines.get(key)!;
        engine.reset();
        const { outcome, duration } = engine.runToCompletion();
        const a = acc.get(key)!;
        if (outcome === Outcome.WIN) {
          a.wins++;
        }
        a.totalTime += duration;
        a.totalRemainingHP += lineHP - engine.tension;
      }

      const count = t + 1;
      setCells(
        pairs.map(({ reel, drag }) => {
          const { wins, totalTime, totalRemainingHP } = acc.get(
            `${reel}-${drag}`,
          )!;
          return {
            reel,
            drag,
            winPct: (wins / count) * 100,
            avgTime: totalTime / count,
            avgRemainingHP: (totalRemainingHP / count / lineHP) * 100,
          };
        }),
      );

      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }

    setRunning(false);
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
      <EngineConfigRow
        config={engineCfg}
        onChange={(patch) => setEngineCfg((c) => ({ ...c, ...patch }))}
      />
      <Flex gap="3" wrap="wrap" align="end">
        <FishSelect fishData={fishData} value={fishId} onChange={setFishId} />
        <NumInput
          label="Attack"
          value={fishSpeed}
          onChange={setFishSpeed}
          min={1}
        />
        <NumInput
          label="Defense"
          value={fishStrength}
          onChange={setFishStrength}
          min={1}
        />
        <NumInput
          label="Thrash"
          value={fishThrash}
          onChange={setFishThrash}
          min={0}
        />
        <NumInput
          label="Base Price"
          value={fishBasePrice}
          onChange={setFishBasePrice}
          min={0}
        />
        <NumInput
          label="Start Distance"
          value={fishStartDistance}
          onChange={setFishStartDistance}
          min={0}
        />
        <NumInput
          label="Starting Distance"
          value={fishStartingDistance}
          onChange={setFishStartingDistance}
          min={0}
        />
      </Flex>
      <Flex gap="3" wrap="wrap" align="end">
        <NumInput label="Line HP" value={lineHP} onChange={setLineHP} min={1} />
        <NumInput label="Min" value={reelMin} onChange={setReelMin} min={1} />
        <NumInput label="Max" value={reelMax} onChange={setReelMax} min={1} />
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
        {running && (
          <Button
            variant="soft"
            color="red"
            onClick={() => {
              cancelRef.current = true;
            }}
          >
            Stop
          </Button>
        )}
      </Flex>

      {cells.length > 0 && (
        <div style={{ width: "50%" }}>
          <SweepSummaryTable cells={cells} fishAtk={fishSpeed} />
        </div>
      )}

      {cells.length > 0 && (
        <Flex gap="6" wrap="wrap">
          <div style={{ minWidth: 320, flex: 1 }}>
            <DiagonalLineChart cells={cells} fishAtk={fishSpeed} />
          </div>
          <div style={{ minWidth: 320, flex: 1 }}>
            <DeltaLineChart
              reelMin={reelMin}
              reelMax={reelMax}
              fishAtk={fishSpeed}
              fishDef={fishStrength}
              engineCfg={engineCfg}
            />
          </div>
        </Flex>
      )}

      {cells.length > 0 && (
        <Flex gap="8" wrap="wrap" pt="2">
          <Heatmap
            title="Win %"
            reelVals={reelVals}
            dragVals={dragVals}
            cells={cells}
            getValue={(c) => c.winPct}
            format={(v) => v.toFixed(0)}
            toColor={winPctToColor}
            fishAD={fishSpeed}
          />
          <Heatmap
            title="Avg Fight Time (s)"
            reelVals={reelVals}
            dragVals={dragVals}
            cells={cells}
            getValue={(c) => c.avgTime}
            format={(v) => (v >= MAX_SIM_TIME ? "—" : v.toFixed(1))}
            toColor={avgTimeToColor}
            fishAD={fishSpeed}
          />
          <Heatmap
            title="Avg Remaining Line HP (%)"
            reelVals={reelVals}
            dragVals={dragVals}
            cells={cells}
            getValue={(c) => c.avgRemainingHP}
            format={(v) => v.toFixed(0)}
            toColor={remainingHPToColor}
            fishAD={fishSpeed}
          />
        </Flex>
      )}
    </Flex>
  );
}
