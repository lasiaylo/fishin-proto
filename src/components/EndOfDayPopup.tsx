import React, { useState } from "react";
import { Box, Flex, Progress, Tabs, Text } from "@radix-ui/themes";
import { startNewDay, useDayStore } from "../stores/dayStore";
import {
  buyDreamUpgrade,
  getDreamUpgradePrice,
  isDreamUpgradeMaxed,
  useDreamShop,
} from "../stores/dreamShopStore";
import { UpgradeCatalogGrid } from "./UpgradeCatalogGrid";
import {
  CURRENCY_SYMBOL,
  computeDreamPoints,
  computeDreamPointsProgress,
  DREAM_POINT_SYMBOL,
} from "../util/constants";
import { MyButton } from "./MyButton";
import {
  animationDuration,
  AnimatedNumber,
  useAnimatedNumber,
} from "./AnimatedNumber";

export function EndOfDayPopup() {
  const dayNumber = useDayStore((s) => s.dayNumber);
  const moneyEarnedToday = useDayStore((s) => s.moneyEarnedToday);
  const fishCaughtToday = useDayStore((s) => s.fishCaughtToday);
  const dreamPoints = useDayStore((s) => s.dreamPoints);
  const cumulativeMoneyEarned = useDayStore((s) => s.cumulativeMoneyEarned);
  const dreamUpgrades = useDreamShop((s) => s.upgrades);
  const [tab, setTab] = useState("report");

  const lvl = computeDreamPoints(cumulativeMoneyEarned);
  const lvlProgress = computeDreamPointsProgress(cumulativeMoneyEarned);
  const lvlProgressPct = Math.round(lvlProgress.fraction * 100);

  // Chain each stat's count-up so it starts only once the previous one
  // finishes, instead of all four animating at once.
  const fishDelay = 0;
  const fishDuration = animationDuration(fishCaughtToday - 0);
  const moneyDelay = fishDelay + fishDuration;
  const moneyDuration = animationDuration(moneyEarnedToday - 0);
  const lvlDelay = moneyDelay + moneyDuration;
  const lvlDuration = animationDuration(lvl - 0);
  const lvlBarDelay = lvlDelay + lvlDuration;

  const animatedLvlProgressPct = useAnimatedNumber(
    lvlProgressPct,
    0,
    lvlBarDelay,
  );

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

          <Tabs.Root value={tab} onValueChange={setTab}>
            <Tabs.List>
              <Tabs.Trigger value="report">report</Tabs.Trigger>
              <Tabs.Trigger value="dream">dream upgrades</Tabs.Trigger>
            </Tabs.List>
            <Tabs.Content value="report">
              <Flex direction="column" gap="2" p="4">
                <Flex justify="between">
                  <Text color="gray">fish caught</Text>
                  <Text>
                    <AnimatedNumber
                      value={fishCaughtToday}
                      initial={0}
                      delay={fishDelay}
                    />
                  </Text>
                </Flex>
                <Flex justify="between">
                  <Text color="gray">money earned</Text>
                  <Text>
                    {CURRENCY_SYMBOL}{" "}
                    <AnimatedNumber
                      value={moneyEarnedToday}
                      initial={0}
                      delay={moneyDelay}
                    />
                  </Text>
                </Flex>
                <Flex direction="column" gap="1">
                  <Flex justify="between">
                    <Text color="gray">LVL</Text>
                    <Text>
                      <AnimatedNumber value={lvl} initial={0} delay={lvlDelay} />
                    </Text>
                  </Flex>
                  <Progress
                    radius="none"
                    size="2"
                    value={animatedLvlProgressPct}
                  />
                  <Text size="1" color="gray" align="right">
                    {lvlProgress.current} / {lvlProgress.next}
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
            {tab === "report" ? (
              <MyButton onClick={() => setTab("dream")}>dream</MyButton>
            ) : (
              <MyButton onClick={startNewDay}>start next day</MyButton>
            )}
          </Flex>
        </Flex>
      </Box>
    </Flex>
  );
}
