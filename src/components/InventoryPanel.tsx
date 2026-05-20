import React from "react";
import {Flex, Text} from "@radix-ui/themes";
import {usePlayer} from "../stores/playerStore";
import {useInventory} from "../stores/inventoryStore";

export function InventoryPanel() {
  const wallet = usePlayer((s) => s.wallet);
  const capacity = usePlayer((s) => s.inventoryCapacity);
  const fish = useInventory((s) => s.fish);

  return (
    <Flex direction="column" flexShrink="0" width="200px">
      <Text size="2" weight="bold" mb="2">
        Money: ${wallet}
      </Text>
      <Text size="2" weight="bold" mb="1">
        Fish ({fish.length} / {capacity})
      </Text>
      <Flex direction="column" gap="1" pl="3">
        {fish.map((f, i) => (
          <Text key={i} size="1" color="gray">
            {f.name}
          </Text>
        ))}
      </Flex>
    </Flex>
  );
}
