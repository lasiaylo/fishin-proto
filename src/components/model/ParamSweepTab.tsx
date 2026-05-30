import React, {
  Fragment,
  useState,
  useEffect,
  useRef,
  type CSSProperties,
} from "react";
import { Flex, Text, Button } from "@radix-ui/themes";
import {
  FightEngine,
  Outcome,
  DEFAULT_FIGHT_CONFIG,
  MAX_SIM_TIME,
  type FightConfig,
} from "../../game/FightEngine";
import type { FishData } from "../../util/csvLoader";
import { NumInput, FishSelect, EngineConfigRow } from "./shared";
import { INITIAL_PLAYER_STATE } from "../../stores/playerStore";

interface SweepCell {
  reel: number;
  drag: number;
  winPct: number;
  avgTime: number;
}

function winPctToColor(pct: number): string {
  return `hsl(${pct * 1.2}, 70%, 35%)`;
}

function avgTimeToColor(t: number): string {
  return `hsl(${240 - Math.min(t / 60, 1) * 240}, 60%, 40%)`;
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

export function ParamSweepTab({ fishData }: { fishData: FishData[] }) {
  const [fishId, setFishId] = useState(fishData[0]?.id ?? "");
  const [fishSpeed, setFishSpeed] = useState(fishData[0]?.attack ?? 0);
  const [fishStrength, setFishStrength] = useState(fishData[0]?.defense ?? 0);
  const [fishThrash, setFishThrash] = useState(fishData[0]?.thrash ?? 0);
  const [fishBasePrice, setFishBasePrice] = useState(
    fishData[0]?.basePrice ?? 0,
  );
  const [lineHP, setLineHP] = useState(10);
  const [reelMin, setReelMin] = useState(INITIAL_PLAYER_STATE.attack);
  const [reelMax, setReelMax] = useState(INITIAL_PLAYER_STATE.attack + 8);
  const dragMin = reelMin;
  const dragMax = reelMax;
  const [trialsPerCell, setTrialsPerCell] = useState(100);
  const [engineCfg, setEngineCfg] = useState<FightConfig>(DEFAULT_FIGHT_CONFIG);
  const [cells, setCells] = useState<SweepCell[]>([]);
  const [running, setRunning] = useState(false);
  const cancelRef = useRef(false);

  useEffect(() => {
    const fish = fishData.find((f) => f.id === fishId);
    if (fish) {
      setFishSpeed(fish.attack);
      setFishStrength(fish.defense);
      setFishThrash(fish.thrash);
      setFishBasePrice(fish.basePrice);
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
        { wins: 0, totalTime: 0 },
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
      }

      const count = t + 1;
      setCells(
        pairs.map(({ reel, drag }) => {
          const { wins, totalTime } = acc.get(`${reel}-${drag}`)!;
          return {
            reel,
            drag,
            winPct: (wins / count) * 100,
            avgTime: totalTime / count,
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
            format={(v) => (v >= MAX_SIM_TIME ? "—" : v.toFixed(1))}
            toColor={avgTimeToColor}
          />
        </Flex>
      )}
    </Flex>
  );
}
