import React, { useState } from "react";
import { Button, Dialog, Flex, Text } from "@radix-ui/themes";
import { Cross2Icon } from "@radix-ui/react-icons";
import { pushEvent } from "../stores/eventLogStore";

const FISHING_SPOTS = ["Fish Shallow End", "Fish Deep End", "Fish Far End"];

export function PondView() {
  const [open, setOpen] = useState(false);

  function onFish(spot: string) {
    pushEvent(`Cast line into the ${spot.replace("Fish ", "").toLowerCase()}...`);
    setOpen(true);
  }

  return (
    <Flex p="4" gap="3" wrap="wrap">
      {FISHING_SPOTS.map((spot) => (
        <Button key={spot} variant="outline" onClick={() => onFish(spot)}>
          {spot}
        </Button>
      ))}

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Content maxWidth="400px">
          <Flex justify="between" align="center" mb="3">
            <Dialog.Title>Fishing</Dialog.Title>
            <Dialog.Close>
              <Button variant="ghost" size="1">
                <Cross2Icon />
              </Button>
            </Dialog.Close>
          </Flex>
          <Text>Fishing minigame coming soon...</Text>
        </Dialog.Content>
      </Dialog.Root>
    </Flex>
  );
}
