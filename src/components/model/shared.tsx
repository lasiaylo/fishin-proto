import React, { useState } from "react";
import { Button, Flex, Grid, Text } from "@radix-ui/themes";
import type { FishData } from "../../util/csvLoader";
import type { FightConfig } from "../../game/FightEngine";

export const COLORS = [
  "#60cdff",
  "#ff6b6b",
  "#69db7c",
  "#ffd43b",
  "#da77f2",
  "#74c0fc",
  "#ff922b",
  "#a9e34b",
];

export function ChartGrid({
  gridLayout,
  children,
}: {
  gridLayout: boolean;
  children: React.ReactNode;
}) {
  return (
    <Grid columns={gridLayout ? "2" : "1"} gap="4">
      {children}
    </Grid>
  );
}

export function GridToggleButton({
  gridLayout,
  onToggle,
}: {
  gridLayout: boolean;
  onToggle: () => void;
}) {
  return (
    <Button variant="soft" onClick={onToggle}>
      {gridLayout ? "List" : "Grid"}
    </Button>
  );
}

export function NumInput({
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

export function EngineConfigRow({
  config,
  onChange,
}: {
  config: FightConfig;
  onChange: (patch: Partial<FightConfig>) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Flex direction="column" gap="2">
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: 0,
          width: "fit-content",
        }}
      >
        <Text size="1" color="gray">
          {open ? "▾" : "▸"} Engine Config
        </Text>
      </button>
      {open && (
        <>
          <Flex gap="3" wrap="wrap" align="end">
            <NumInput
              label="Rest Min"
              value={config.restTimeRange[0]}
              onChange={(v) =>
                onChange({ restTimeRange: [v, config.restTimeRange[1]] })
              }
              min={0}
            />
            <NumInput
              label="Rest Max"
              value={config.restTimeRange[1]}
              onChange={(v) =>
                onChange({ restTimeRange: [config.restTimeRange[0], v] })
              }
              min={0}
            />
            <NumInput
              label="Fight Min"
              value={config.fightTimeRange[0]}
              onChange={(v) =>
                onChange({ fightTimeRange: [v, config.fightTimeRange[1]] })
              }
              min={0}
            />
            <NumInput
              label="Fight Max"
              value={config.fightTimeRange[1]}
              onChange={(v) =>
                onChange({ fightTimeRange: [config.fightTimeRange[0], v] })
              }
              min={0}
            />
            <NumInput
              label="Init Min"
              value={config.initStruggleDuration[0]}
              onChange={(v) =>
                onChange({
                  initStruggleDuration: [v, config.initStruggleDuration[1]],
                })
              }
              min={0}
            />
            <NumInput
              label="Init Max"
              value={config.initStruggleDuration[1]}
              onChange={(v) =>
                onChange({
                  initStruggleDuration: [config.initStruggleDuration[0], v],
                })
              }
              min={0}
            />
          </Flex>
          <Flex gap="3" wrap="wrap" align="end">
            <NumInput
              label="Base Speed"
              value={config.baseSpeed}
              onChange={(v) => onChange({ baseSpeed: v })}
            />
          </Flex>
        </>
      )}
    </Flex>
  );
}

export function FishSelect({
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
