import { Code, Flex, Progress, Text } from "@radix-ui/themes";
import React, { useEffect, useRef, useState } from "react";
import { usePlayer } from "../stores/playerStore";
import { useBaitData } from "../stores/baitStore";
import { useShop } from "../stores/shopStore";
import { phaseForElapsed, tickDay, useDayStore } from "../stores/dayStore";
import { CURRENCY_SYMBOL, DAY_DURATION_MS, RARITY_COLOR } from "../util/constants";
import { StatName } from "../util/csvLoader";
import { AnimatedNumber } from "./AnimatedNumber";

const DAY_PHASE_LABEL: Record<string, string> = {
  NIGHT: "night",
  DAWN: "dawn",
  SUNRISE: "sunrise",
};

export function InventoryView() {
  const wallet = usePlayer((s) => s.wallet);
  const dayStartTime = useDayStore((s) => s.dayStartTime);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      tickDay(t);
    }, 250);
    return () => clearInterval(id);
  }, []);

  const elapsed = Math.max(0, now - dayStartTime);
  const remainingPct =
    (Math.max(0, DAY_DURATION_MS - elapsed) / DAY_DURATION_MS) * 100;
  const dayPhase = phaseForElapsed(elapsed);

  const inventory = usePlayer((s) => s.inventory);
  const inventorySize = usePlayer((s) => s.inventorySize);
  const baitInventory = usePlayer((s) => s.baitInventory);
  const baitData = useBaitData((s) => s.baitData);
  const ownedLures = usePlayer((s) => s.ownedLures);
  const upgrades = useShop((s) => s.upgrades);
  const lures = upgrades.filter(
    (u) => u.stat === StatName.LURE && ownedLures.has(u.id),
  );

  const prevWalletRef = useRef(wallet);
  const [popup, setPopup] = useState<{ amount: number; key: number } | null>(
    null,
  );

  useEffect(() => {
    const diff = wallet - prevWalletRef.current;
    prevWalletRef.current = wallet;
    if (diff > 0) {
      setPopup({ amount: diff, key: Date.now() });
    }
  }, [wallet]);

  return (
    <Flex
      position={"relative"}
      direction="column"
      flexShrink="0"
      width="200px"
      gap={"6"}
      pt="40px"
    >
      <Flex direction="column" gap="1">
        <Progress radius="none" size="2" value={remainingPct} />
        <Text size="1" color="gray">
          {DAY_PHASE_LABEL[dayPhase] ?? dayPhase}
        </Text>
      </Flex>

      <Flex width={"100%"} direction={"column"}>
        <Code size="2">
          {CURRENCY_SYMBOL} <AnimatedNumber value={wallet} />
        </Code>
        {popup && (
          <Code
            key={popup.key}
            size="2"
            color="grass"
            className="sale-popup"
            onAnimationEnd={() => setPopup(null)}
          >
            +{popup.amount}
          </Code>
        )}
      </Flex>

      <Flex direction="column" gap="1">
        <Text size="1" color="gray">
          cooler
        </Text>
        {Array.from({ length: inventorySize }).map((_, i) => {
          const item = inventory[i];
          return (
            <Code
              key={i}
              size="1"
              color={item ? RARITY_COLOR[item.rarity] : "gray"}
            >
              {item ? `${item.fish.name}` : "—"}
            </Code>
          );
        })}
      </Flex>

      <Flex direction="column" gap="2">
        <Text size="1" color="gray" weight={"medium"}>
          tackle box
        </Text>
        <Flex direction="column" gap="1">
          <Text size="1" color="gray">
            bait
          </Text>
          <Flex direction="column" gap="1">
            {Object.entries(baitInventory).map(([id, count]) => {
              const bait = baitData.find((b) => b.id === id);
              return (
                <Code key={id} size="1" color={count > 0 ? "gray" : "red"}>
                  {bait?.name ?? id} ×{count}
                </Code>
              );
            })}
          </Flex>
        </Flex>

        {lures.length > 0 && (
          <Flex direction="column" gap="1">
            <Text size="1" color="gray">
              lures
            </Text>
            <Flex direction="column" gap="1">
              {lures.map((lure) => (
                <Code key={lure.id} size="1" color="gray">
                  {lure.name}
                </Code>
              ))}
            </Flex>
          </Flex>
        )}
      </Flex>
    </Flex>
  );
}
