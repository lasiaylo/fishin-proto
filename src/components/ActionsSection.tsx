import React, { useState } from "react";
import { Flex, Tabs } from "@radix-ui/themes";
import { PondView } from "./PondView";
import { FieldsView } from "./FieldsView";
import { SkyView } from "./SkyView";

export function ActionsSection() {
  const [tab, setTab] = useState("pond");

  return (
    <Flex flexGrow="1" direction="column" width="50vw">
      <Tabs.Root value={tab} onValueChange={setTab}>
        <Tabs.Content value="fields">
          <Flex className={"fade-in"}>
            <FieldsView />
          </Flex>
        </Tabs.Content>
        {/* forceMount keeps PondView (and its cast/lure/fight rAF loop)
            mounted while fields/sky is the active tab, so a line in the
            water doesn't freeze or reset just because it's off screen. */}
        <Tabs.Content value="pond" forceMount>
          <Flex className={"fade-in"}>
            <PondView />
          </Flex>
        </Tabs.Content>
        <Tabs.Content value="sky">
          <Flex className={"fade-in"}>
            <SkyView />
          </Flex>
        </Tabs.Content>
        <Tabs.List>
          <Tabs.Trigger value="fields">fields</Tabs.Trigger>
          <Tabs.Trigger value="pond">pond</Tabs.Trigger>
          <Tabs.Trigger value="sky">sky</Tabs.Trigger>
        </Tabs.List>
      </Tabs.Root>
    </Flex>
  );
}
