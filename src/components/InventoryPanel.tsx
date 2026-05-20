import React from "react";
import { Flex, Text } from "@radix-ui/themes";
import { usePlayer } from "../stores/playerStore";

export function InventoryPanel() {
  const wallet = usePlayer((s) => s.wallet);

  return (
    <Flex mt="8" direction="column" flexShrink="0" width="200px">
      <Text size="2" weight="bold">
        Money: ${wallet}
      </Text>
    </Flex>
  );
}
