import { Code, Flex, Text } from "@radix-ui/themes";
import React from "react";
import { usePlayer } from "../stores/playerStore";
import { useBaitData } from "../stores/baitStore";
import { useShop } from "../stores/shopStore";
import { StatName } from "../util/csvLoader";
import { TipView } from "./TipView";

export const TACKLE_BOX_WIDTH = 200;

export function TackleBoxView() {
  const baitInventory = usePlayer((s) => s.baitInventory);
  const baitData = useBaitData((s) => s.baitData);
  const ownedLures = usePlayer((s) => s.ownedLures);
  const upgrades = useShop((s) => s.upgrades);
  const lures = upgrades.filter(
    (u) => u.stat === StatName.LURE && ownedLures.has(u.id),
  );

  return (
    <Flex
      position={"relative"}
      direction="column"
      flexShrink="0"
      width={`${TACKLE_BOX_WIDTH}px`}
      gap={"6"}
    >
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

      <TipView />
    </Flex>
  );
}
