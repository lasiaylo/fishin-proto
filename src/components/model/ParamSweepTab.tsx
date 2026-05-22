import React, {
  Fragment,
  useState,
  useEffect,
  type CSSProperties,
} from "react";
import { Flex, Text, Button } from "@radix-ui/themes";
import { FightEngine } from "../../game/FightEngine";
import type { FishData } from "../../util/csvLoader";
import { NumInput, FishSelect } from "./shared";

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

export function ParamSweepTab({ fishData }: { fishData: FishData[] }) {
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
