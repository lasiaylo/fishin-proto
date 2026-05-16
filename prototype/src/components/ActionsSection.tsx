import React, { useState } from "react";
import { Flex, Tabs, Text } from "@radix-ui/themes";
import { ShopView } from "./ShopView";
import { PondView } from "./PondView";
import {
  clearInventory,
  getInventoryCount,
  getTotalFishValue,
} from "../stores/inventoryStore";
import { addMoney } from "../stores/playerStore";
import { pushEvent } from "../stores/eventLogStore";

enum Location {
  Shop = "Shop",
  Pond = "Pond",
}

function sellAllFish() {
  const count = getInventoryCount();
  if (count === 0) return;
  const total = getTotalFishValue();
  addMoney(total);
  clearInventory();
  pushEvent(`Sold ${count} fish for $${total}`);
}

export function ActionsSection() {
  const [location, setLocation] = useState<Location>(Location.Shop);

  function onTabChange(val: string) {
    const next = val as Location;
    if (next === Location.Shop) {
      sellAllFish();
    }
    setLocation(next);
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
