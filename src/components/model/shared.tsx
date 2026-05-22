import React from "react";
import { Text } from "@radix-ui/themes";
import type { FishData } from "../../util/csvLoader";

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
