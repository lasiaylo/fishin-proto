import React, { useState } from "react";
import { Flex, Text } from "@radix-ui/themes";
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
              value={config.restTime[0]}
              onChange={(v) => onChange({ restTime: [v, config.restTime[1]] })}
              min={0}
            />
            <NumInput
              label="Rest Max"
              value={config.restTime[1]}
              onChange={(v) => onChange({ restTime: [config.restTime[0], v] })}
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
              label="Stamina"
              value={config.fishStamina}
              onChange={(v) => onChange({ fishStamina: v })}
              min={0}
            />
            <NumInput
              label="Timeout"
              value={config.fishTimeout}
              onChange={(v) => onChange({ fishTimeout: v })}
              min={0}
            />
            <NumInput
              label="Super Dur"
              value={config.superStruggleDuration}
              onChange={(v) => onChange({ superStruggleDuration: v })}
              min={0}
            />
            <NumInput
              label="Init Dur"
              value={config.initStruggleDuration}
              onChange={(v) => onChange({ initStruggleDuration: v })}
              min={0}
            />
          </Flex>
          <Flex gap="3" wrap="wrap" align="end">
            <NumInput
              label="Base Speed"
              value={config.baseSpeed}
              onChange={(v) => onChange({ baseSpeed: v })}
            />
            <NumInput
              label="Min Speed"
              value={config.minSpeed}
              onChange={(v) => onChange({ minSpeed: v })}
              min={-999}
            />
            <NumInput
              label="Base Reel"
              value={config.baseReel}
              onChange={(v) => onChange({ baseReel: v })}
              min={0}
            />
            <NumInput
              label="Max Reel"
              value={config.maxReel}
              onChange={(v) => onChange({ maxReel: v })}
              min={0}
            />
            <NumInput
              label="Speed Growth"
              value={config.speedGrowth}
              onChange={(v) => onChange({ speedGrowth: v })}
              min={0}
            />
            <NumInput
              label="Reel Growth"
              value={config.reelGrowth}
              onChange={(v) => onChange({ reelGrowth: v })}
              min={0}
            />
            <NumInput
              label="Attack %"
              value={config.attackChance}
              onChange={(v) => onChange({ attackChance: v })}
              min={0}
              max={1}
            />
            <NumInput
              label="OL Threshold"
              value={config.outLeveledThreshold}
              onChange={(v) => onChange({ outLeveledThreshold: v })}
              min={0}
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
