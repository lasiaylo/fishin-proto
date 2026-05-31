import { Code, Flex, Text } from "@radix-ui/themes";
import React from "react";
import { usePlayer } from "../stores/playerStore";

export function InventoryView() {
  const wallet = usePlayer((s) => s.wallet);
  const inventory = usePlayer((s) => s.inventory);
  const inventorySize = usePlayer((s) => s.inventorySize);

  return (
    <Flex
      position={"relative"}
      mt="6"
      direction="column"
      flexShrink="0"
      maxHeight="500px"
      width="200px"
      gap={"3"}
    >
      <Code size="2">${wallet}</Code>
      <Flex direction="column" gap="1">
        <Text size="1" color="gray">
          fish cooler
        </Text>
        {Array.from({ length: inventorySize }).map((_, i) => {
          const fish = inventory[i];
          return (
            <Code key={i} size="1" color={fish ? undefined : "gray"}>
              {fish ? `${fish.name}` : "—"}
            </Code>
          );
        })}
      </Flex>
    </Flex>
  );
}
