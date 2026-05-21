import { Code, Flex, Text } from "@radix-ui/themes";
import React from "react";
import { usePlayer } from "../stores/playerStore";

export function InventoryView() {
  const wallet = usePlayer((s) => s.wallet);

  return (
    <Flex
      position={"relative"}
      mt="6"
      direction="column"
      flexShrink="0"
      maxHeight="500px"
      width="200px"
      gap={"5"}
    >
      <Code size="2">Money: ${wallet}</Code>
    </Flex>
  );
}
