import React, { useState } from "react";
import { Flex, Tabs } from "@radix-ui/themes";
import { ShopView } from "./ShopView";
import { PondView } from "./PondView";
import { sellAllFish, usePlayer } from "../stores/playerStore";
import { pushEvent } from "../stores/eventLogStore";
import { EventMsg } from "../util/eventMessages";

export function ActionsSection() {
  const [tab, setTab] = useState("pond");

  function handleTabChange(value: string) {
    if (value === "shop") {
      const inventory = usePlayer.getState().inventory;
      if (inventory.length > 0) {
        sellAllFish();
        inventory.forEach((fish, i) =>
          setTimeout(
            () => pushEvent(EventMsg.SOLD_FISH(fish.name, fish.basePrice)),
            i * 400,
          ),
        );
      }
    }
    setTab(value);
  }

  return (
    <Flex flexGrow="1" direction="column" maxWidth={"500px"}>
      <Tabs.Root value={tab} onValueChange={handleTabChange}>
        <Tabs.List>
          <Tabs.Trigger value="pond">Pond</Tabs.Trigger>
          <Tabs.Trigger value="shop">Shop</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="pond">
          <Flex className={"fade-in"}>
            <PondView />
          </Flex>
        </Tabs.Content>
        <Tabs.Content value="shop">
          <Flex className={"fade-in"}>
            <ShopView />
          </Flex>
        </Tabs.Content>
      </Tabs.Root>
    </Flex>
  );
}
