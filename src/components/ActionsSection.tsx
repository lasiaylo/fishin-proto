import React, { useState } from "react";
import { Flex, Tabs, Text } from "@radix-ui/themes";
import { ShopView } from "./ShopView";
import { PondView } from "./PondView";

enum Location {
  Shop = "Shop",
  Pond = "Pond",
}

export function ActionsSection() {
  const [location, setLocation] = useState<Location>(Location.Shop);

  function onTabChange(val: string) {
    setLocation(val as Location);
  }

  return (
    <Flex flexGrow="1" direction="column">
      <Tabs.Root value={location} onValueChange={onTabChange}>
        <Tabs.List>
          <Tabs.Trigger value={Location.Shop}>The Shop</Tabs.Trigger>
          <Tabs.Trigger value={Location.Pond}>The Pond</Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value={Location.Shop}>
          <ShopView />
        </Tabs.Content>

        <Tabs.Content value={Location.Pond}>
          <PondView />
        </Tabs.Content>
      </Tabs.Root>
    </Flex>
  );
}
