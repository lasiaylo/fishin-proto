import "@radix-ui/themes/styles.css";
import React, { useState, useEffect } from "react";
import { Theme, Tabs, Flex, Text } from "@radix-ui/themes";
import {
  loadFishData,
  loadShopData,
  type FishData,
  type ShopUpgradeData,
} from "../util/csvLoader";
import { FightTraceTab } from "./model/FightTraceTab";
import { ParamSweepTab } from "./model/ParamSweepTab";
import { EconomyTab } from "./model/EconomyTab";

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
