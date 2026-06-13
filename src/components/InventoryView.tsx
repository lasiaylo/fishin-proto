import { Code, Flex, Select, Text } from "@radix-ui/themes";
import React from "react";
import { setSelectedLure, usePlayer } from "../stores/playerStore";
import { useShop } from "../stores/shopStore";
import { StatName } from "../util/csvLoader";

export function InventoryView() {
  const wallet = usePlayer((s) => s.wallet);
  const inventory = usePlayer((s) => s.inventory);
  const inventorySize = usePlayer((s) => s.inventorySize);
  const ownedLures = usePlayer((s) => s.ownedLures);
  const selectedLure = usePlayer((s) => s.selectedLure);
  const shopUpgrades = useShop((s) => s.upgrades);

  const ownedLureList = shopUpgrades.filter(
    (u) => u.stat === StatName.LURE && ownedLures.has(u.id),
  );

  return (
    <Flex
      position={"relative"}
      direction="column"
      flexShrink="0"
      width="200px"
      gap={"6"}
      pt="40px"
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
      <Flex direction="column" gap="2">
        <Text size="1">lure</Text>
        <Select.Root
          size="1"
          value={selectedLure ?? "__none__"}
          onValueChange={(v) => setSelectedLure(v === "__none__" ? null : v)}
        >
          <Select.Trigger variant={"soft"} />
          <Select.Content>
            <Select.Item value="__none__">none</Select.Item>
            {ownedLureList.map((u) => (
              <Select.Item key={u.id} value={u.id}>
                {u.name}
              </Select.Item>
            ))}
          </Select.Content>
        </Select.Root>
      </Flex>
    </Flex>
  );
}
