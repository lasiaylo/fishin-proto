import React from "react";
import { Flex, Button } from "@radix-ui/themes";
import { FISH_CSVS, SHOP_CSVS } from "../../stores/csvConfigStore";
import { GENERATED_FISH_CSV, GENERATED_SHOP_CSV } from "./CsvGenerator";
import { CsvSelect } from "./shared";

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
      <CsvSelect
        label="Fish CSV"
        value={pair.fishCSV}
        csvs={FISH_CSVS}
        generatedValue={GENERATED_FISH_CSV}
        showGenerated={generatedFish}
        onChange={(v) => onUpdate({ fishCSV: v })}
        gap={2}
      />
      <CsvSelect
        label="Shop CSV"
        value={pair.shopCSV}
        csvs={SHOP_CSVS}
        generatedValue={GENERATED_SHOP_CSV}
        showGenerated={generatedShop}
        onChange={(v) => onUpdate({ shopCSV: v })}
        gap={2}
      />
      {removable && (
        <Button size="1" variant="soft" color="red" onClick={onRemove}>
          Remove
        </Button>
      )}
    </Flex>
  );
}
