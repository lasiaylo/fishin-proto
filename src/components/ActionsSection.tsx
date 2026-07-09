import React, { useState } from "react";
import { Flex, Tabs } from "@radix-ui/themes";
import { ShopView } from "./ShopView";
import { PondView } from "./PondView";
import { sellAllFish, usePlayer } from "../stores/playerStore";
import { pushEvent } from "../stores/eventLogStore";
import { useSessionLog } from "../stores/sessionLogStore";
import { RARITY_COLOR } from "../util/constants";
import { EventMsg } from "../util/eventMessages";

export function ActionsSection() {
  const [tab, setTab] = useState("pond");

  function handleTabChange(value: string) {
    if (value === "shop") {
      const { inventory, wallet, lineHP, inventorySize } =
        usePlayer.getState();
      if (inventory.length > 0) {
        useSessionLog.getState().finalizeRound(wallet, {
          lineHP,
          inventorySize,
        });
        sellAllFish();
        inventory.forEach((fish, i) =>
          setTimeout(() => {
            const msg = EventMsg.SOLD_FISH(fish.fish.name, fish.effectivePrice);
            pushEvent(msg[0], msg[1], RARITY_COLOR[fish.rarity]);
          }, i * 400),
        );
      }
    }
    setTab(value);
  }

  return (
    <Flex flexGrow="1" direction="column" maxWidth={"500px"}>
      <Tabs.Root value={tab} onValueChange={handleTabChange}>
        <Tabs.List>
          <Tabs.Trigger value="pond">pond</Tabs.Trigger>
          <Tabs.Trigger value="shop">shop</Tabs.Trigger>
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
