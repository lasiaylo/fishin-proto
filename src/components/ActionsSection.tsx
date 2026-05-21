import React from "react";
import { Flex, Tabs } from "@radix-ui/themes";
import { ShopView } from "./ShopView";
import { PondView } from "./PondView";

export function ActionsSection() {
  return (
    <Flex flexGrow="1" direction="column" maxWidth={"500px"}>
      <Tabs.Root defaultValue="shop">
        <Tabs.List>
          <Tabs.Trigger value="shop">Shop</Tabs.Trigger>
          <Tabs.Trigger value="pond">Pond</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="shop">
          <Flex className={"fade-in"}>
            <ShopView />
          </Flex>
        </Tabs.Content>
        <Tabs.Content value="pond">
          <Flex className={"fade-in"}>
            <PondView />
          </Flex>
        </Tabs.Content>
      </Tabs.Root>
    </Flex>
  );
}
