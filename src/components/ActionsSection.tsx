import React from "react";
import { Flex, Tabs } from "@radix-ui/themes";
import { PondView, TACKLE_BOX_GUTTER } from "./PondView";
import { FieldsView } from "./FieldsView";
import { SkyView } from "./SkyView";
import { ActionTab, setActiveTab, useActiveTab } from "../stores/tabStore";

export function ActionsSection() {
  const tab = useActiveTab((s) => s.tab);

  return (
    // Widened by the tackle box's gutter so the rod rows keep their full 50vw
    // and the stat bars don't overflow into the pinned tackle box.
    <Flex
      flexGrow="1"
      direction="column"
      width={`calc(50vw + ${TACKLE_BOX_GUTTER})`}
    >
      <Tabs.Root
        value={tab}
        onValueChange={(t) => setActiveTab(t as ActionTab)}
      >
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
