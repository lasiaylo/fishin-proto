import React from "react";
import { Box, Flex, Tabs, Text } from "@radix-ui/themes";
import { startNewDay, useDayStore } from "../stores/dayStore";
import {
  buyDreamUpgrade,
  getDreamUpgradePrice,
  isDreamUpgradeMaxed,
  useDreamShop,
} from "../stores/dreamShopStore";
import { UpgradeCatalogGrid } from "./UpgradeCatalogGrid";
import { CURRENCY_SYMBOL, DREAM_POINT_SYMBOL } from "../util/constants";
import { MyButton } from "./MyButton";

export function EndOfDayPopup() {
  const dayNumber = useDayStore((s) => s.dayNumber);
  const moneyEarnedToday = useDayStore((s) => s.moneyEarnedToday);
  const fishCaughtToday = useDayStore((s) => s.fishCaughtToday);
  const dreamPoints = useDayStore((s) => s.dreamPoints);
  const dreamUpgrades = useDreamShop((s) => s.upgrades);

  return (
    <Flex
      align="center"
      justify="center"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.6)",
        zIndex: 1000,
      }}
    >
      <Box
        style={{
          background: "var(--color-background)",
          border: "1px solid var(--gray-6)",
          maxWidth: "600px",
          width: "90vw",
          maxHeight: "80vh",
          overflowY: "auto",
        }}
      >
        <Flex direction="column" gap="4" p="4">
          <Text size="3" weight="bold">
            day {dayNumber} complete
          </Text>

          <Tabs.Root defaultValue="report">
            <Tabs.List>
              <Tabs.Trigger value="report">report</Tabs.Trigger>
              <Tabs.Trigger value="dream">dream upgrades</Tabs.Trigger>
            </Tabs.List>
            <Tabs.Content value="report">
              <Flex direction="column" gap="2" p="4">
                <Flex justify="between">
                  <Text color="gray">fish caught</Text>
                  <Text>{fishCaughtToday}</Text>
                </Flex>
                <Flex justify="between">
                  <Text color="gray">money earned</Text>
                  <Text>
                    {CURRENCY_SYMBOL} {moneyEarnedToday}
                  </Text>
                </Flex>
                <Flex justify="between">
                  <Text color="gray">dream points</Text>
                  <Text>
                    {DREAM_POINT_SYMBOL} {dreamPoints}
                  </Text>
                </Flex>
              </Flex>
            </Tabs.Content>
            <Tabs.Content value="dream">
              <UpgradeCatalogGrid
                upgrades={dreamUpgrades}
                currency={dreamPoints}
                currencySymbol={DREAM_POINT_SYMBOL}
                getPrice={getDreamUpgradePrice}
                isMaxed={isDreamUpgradeMaxed}
                onBuy={buyDreamUpgrade}
              />
            </Tabs.Content>
          </Tabs.Root>

          <Flex justify="end">
            <MyButton onClick={startNewDay}>start next day</MyButton>
          </Flex>
        </Flex>
      </Box>
    </Flex>
  );
}
