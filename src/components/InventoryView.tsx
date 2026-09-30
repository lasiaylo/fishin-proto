import { Code, Flex, Separator, Text } from "@radix-ui/themes";
import React, { useState } from "react";
import { toggleFishLock, usePlayer } from "../stores/playerStore";
import { useBaitData } from "../stores/baitStore";
import { useShop } from "../stores/shopStore";
import { LOCK_SYMBOL, Rarity, RARITY_COLOR } from "../util/constants";
import { StatName } from "../util/csvLoader";
import { TipView } from "./TipView";

export function InventoryView() {
  const inventory = usePlayer((s) => s.inventory);
  const inventorySize = usePlayer((s) => s.inventorySize);
  const baitInventory = usePlayer((s) => s.baitInventory);
  const baitData = useBaitData((s) => s.baitData);
  const ownedLures = usePlayer((s) => s.ownedLures);
  const upgrades = useShop((s) => s.upgrades);
  const lures = upgrades.filter(
    (u) => u.stat === StatName.LURE && ownedLures.has(u.id),
  );

  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

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
        {Array.from({ length: inventorySize }).map((_, i) => {
          const item = inventory[i];
          const showLock = item && (item.locked || hoveredIndex === i);
          return (
            <Code
              key={i}
              size="1"
              color={item ? RARITY_COLOR[item.rarity] : "gray"}
              className={
                item?.rarity === Rarity.LEGENDARY
                  ? "rarity-legendary"
                  : undefined
              }
              onClick={item ? () => toggleFishLock(i) : undefined}
              onMouseEnter={item ? () => setHoveredIndex(i) : undefined}
              onMouseLeave={item ? () => setHoveredIndex(null) : undefined}
              style={item ? { cursor: "pointer" } : undefined}
            >
              {item
                ? `${showLock ? `${LOCK_SYMBOL} ` : ""}${item.fish.name}`
                : "—"}
            </Code>
          );
        })}
      </Flex>

      <Flex direction="column" gap="2">
        <Separator size={"4"} />
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

      <TipView />
    </Flex>
  );
}
