import React, { useState } from "react";
import { Flex, Tabs, Text } from "@radix-ui/themes";
import { PondView } from "./PondView";

export function ActionsSection() {
  const [tab, setTab] = useState("pond");

  return (
    <Flex flexGrow="1" direction="column" maxWidth={"500px"}>
      <Tabs.Root value={tab} onValueChange={setTab}>
        <Tabs.Content value="fields">
          <Flex className={"fade-in"}>
            <Text size="1" color="gray">
              coming soon
            </Text>
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
            <Text size="1" color="gray">
              coming soon
            </Text>
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
