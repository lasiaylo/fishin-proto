import React from "react";
import { Flex, Text, Button } from "@radix-ui/themes";
import { FISH_CSVS, SHOP_CSVS } from "../../stores/csvConfigStore";
import { GENERATED_FISH_CSV, GENERATED_SHOP_CSV } from "./CsvGenerator";

export interface CsvPair {
  id: string;
  fishCSV: string;
  shopCSV: string;
  label: string;
}

let _pairCounter = 0;
export function newPairId(): string {
  return String(++_pairCounter);
}

export function PairRow({
  pair,
  color,
  removable,
  generatedFish,
  generatedShop,
  onUpdate,
  onRemove,
}: {
  pair: CsvPair;
  color: string;
  removable: boolean;
  generatedFish: boolean;
  generatedShop: boolean;
  onUpdate: (patch: Partial<Omit<CsvPair, "id">>) => void;
  onRemove: () => void;
}) {
  return (
    <Flex gap="2" align="center" wrap="wrap">
      <div
        style={{
          width: 10,
          height: 10,
          borderRadius: 2,
          background: color,
          flexShrink: 0,
        }}
      />
      <input
        value={pair.label}
        onChange={(e) => onUpdate({ label: e.target.value })}
        style={{ width: 80 }}
      />
      <label style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <Text size="1" color="gray">
          Fish CSV
        </Text>
        <select
          value={pair.fishCSV}
          onChange={(e) => onUpdate({ fishCSV: e.target.value })}
        >
          {FISH_CSVS.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
          {generatedFish && (
            <option value={GENERATED_FISH_CSV}>Generated</option>
          )}
        </select>
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <Text size="1" color="gray">
          Shop CSV
        </Text>
        <select
          value={pair.shopCSV}
          onChange={(e) => onUpdate({ shopCSV: e.target.value })}
        >
          {SHOP_CSVS.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
          {generatedShop && (
            <option value={GENERATED_SHOP_CSV}>Generated</option>
          )}
        </select>
      </label>
      {removable && (
        <Button size="1" variant="soft" color="red" onClick={onRemove}>
          Remove
        </Button>
      )}
    </Flex>
  );
}
