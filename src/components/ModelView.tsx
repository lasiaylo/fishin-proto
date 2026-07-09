import "@radix-ui/themes/styles.css";
import React, { useState, useEffect, useMemo } from "react";
import { Theme, Tabs, Flex, Text, Select } from "@radix-ui/themes";
import {
  loadFishData,
  loadLocationGameplayData,
  loadRodData,
  loadShopGameplayData,
  parseFishGameplayRows,
  type FishData,
  type LocationFishEntry,
  type RodData,
  type ShopUpgradeData,
} from "../util/csvLoader";
import { FightTraceTab } from "./model/FightTraceTab";
import { ParamSweepTab } from "./model/ParamSweepTab";
import { EconomyTab } from "./model/EconomyTab";
import { GraphsTab } from "./model/GraphsTab";
import {
  getGeneratedFishRows,
  getGeneratedShopRows,
} from "./model/CsvGenerator";

export function ModelView() {
  const [fishData, setFishData] = useState<FishData[]>([]);
  const [shopData, setShopData] = useState<ShopUpgradeData[]>([]);
  const [locationData, setLocationData] = useState<LocationFishEntry[]>([]);
  const [rodData, setRodData] = useState<RodData[]>([]);
  const [activeTab, setActiveTab] = useState(
    () => localStorage.getItem("debugTab") ?? "fight",
  );
  const [generatedFishRows, setGeneratedFishRows] = useState<string[][] | null>(
    null,
  );
  const [generatedShopRows, setGeneratedShopRows] = useState<string[][] | null>(
    null,
  );
  const [fishSource, setFishSource] = useState<"csv" | "generated">(
    () => (localStorage.getItem("debugFishSource") as "csv" | "generated") ?? "csv",
  );

  useEffect(() => {
    setGeneratedFishRows(getGeneratedFishRows());
    setGeneratedShopRows(getGeneratedShopRows());
    Promise.all([
      loadFishData(),
      loadShopGameplayData(),
      loadLocationGameplayData(),
      loadRodData(),
    ]).then(([fish, shop, location, rod]) => {
      setFishData(fish);
      setShopData(shop);
      setLocationData(location);
      setRodData(rod);
    });
  }, []);

  const activeFishData = useMemo(() => {
    if (fishSource === "generated" && generatedFishRows) {
      return parseFishGameplayRows(generatedFishRows);
    }
    return fishData;
  }, [fishSource, fishData, generatedFishRows]);

  return (
    <Theme
      appearance="dark"
      accentColor="cyan"
      grayColor="mauve"
      style={
        {
          "--default-font-family":
            "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        } as React.CSSProperties
      }
    >
      <Flex
        direction="column"
        p="4"
        gap="4"
        style={{
          minHeight: "100vh",
        }}
      >
        <Flex align="center" gap="4">
          <Text size="6" weight="bold">
            Model
          </Text>
          <Flex align="center" gap="2">
            <Text size="2" color="gray">Fish source:</Text>
            <Select.Root
              value={fishSource}
              onValueChange={(v) => {
                const src = v as "csv" | "generated";
                setFishSource(src);
                localStorage.setItem("debugFishSource", src);
              }}
            >
              <Select.Trigger />
              <Select.Content>
                <Select.Item value="csv">FishGameplay.csv</Select.Item>
                <Select.Item value="generated" disabled={!generatedFishRows}>
                  Generated{!generatedFishRows ? " (none yet)" : ""}
                </Select.Item>
              </Select.Content>
            </Select.Root>
          </Flex>
        </Flex>
        {fishData.length === 0 ? (
          <Text color="gray">Loading data…</Text>
        ) : (
          <Tabs.Root
            value={activeTab}
            onValueChange={(v) => {
              setActiveTab(v);
              localStorage.setItem("debugTab", v);
            }}
          >
            <Tabs.List>
              <Tabs.Trigger value="fight">Fight Trace</Tabs.Trigger>
              <Tabs.Trigger value="sweep">Parameter Sweep</Tabs.Trigger>
              <Tabs.Trigger value="economy">Economy</Tabs.Trigger>
              <Tabs.Trigger value="graphs">Graphs</Tabs.Trigger>
            </Tabs.List>
            <Tabs.Content value="fight">
              <FightTraceTab fishData={activeFishData} />
            </Tabs.Content>
            <Tabs.Content value="sweep">
              <ParamSweepTab fishData={activeFishData} />
            </Tabs.Content>
            <Tabs.Content value="economy">
              <EconomyTab
                locationData={locationData}
                rodData={rodData}
                generatedFishRows={generatedFishRows}
                generatedShopRows={generatedShopRows}
                onFishRowsChange={setGeneratedFishRows}
                onShopRowsChange={setGeneratedShopRows}
              />
            </Tabs.Content>
            <Tabs.Content value="graphs">
              <GraphsTab
                fishData={fishData}
                locationData={locationData}
                generatedFishRows={generatedFishRows}
                generatedShopRows={generatedShopRows}
                onFishRowsChange={setGeneratedFishRows}
                onShopRowsChange={setGeneratedShopRows}
              />
            </Tabs.Content>
          </Tabs.Root>
        )}
      </Flex>
    </Theme>
  );
}
