import React, { useState } from "react";
import { Flex, Tabs, Text } from "@radix-ui/themes";

enum Location {
  Shop = "Shop",
  Pond = "Pond",
}

export function ActionsSection() {
  const [location, setLocation] = useState<Location>(Location.Shop);

  return (
    <Flex flexGrow="1" direction="column">
      <Tabs.Root
        value={location}
        onValueChange={(val) => setLocation(val as Location)}
      >
        <Tabs.List>
          <Tabs.Trigger value={Location.Shop}>The Shop</Tabs.Trigger>
          <Tabs.Trigger value={Location.Pond}>The Pond</Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value={Location.Shop}>
          <Flex p="4">
            <Text>Shop actions coming in Phase 5...</Text>
          </Flex>
        </Tabs.Content>

        <Tabs.Content value={Location.Pond}>
          <Flex p="4">
            <Text>Pond actions coming in Phase 6...</Text>
          </Flex>
        </Tabs.Content>
      </Tabs.Root>
    </Flex>
  );
}
