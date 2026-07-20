import { Code, Dialog, Flex, Text } from "@radix-ui/themes";
import React from "react";
import { giftFish } from "../stores/friendStore";
import { usePlayer } from "../stores/playerStore";
import { Rarity, RARITY_COLOR } from "../util/constants";

export function GiftDialog({
  npcName,
  onClose,
}: {
  npcName: string | null;
  onClose: () => void;
}) {
  const inventory = usePlayer((s) => s.inventory);

  function handleGift(index: number) {
    if (!npcName) return;
    giftFish(npcName, index);
    onClose();
  }

  return (
    <Dialog.Root
      open={npcName !== null}
      onOpenChange={(open) => !open && onClose()}
    >
      <Dialog.Content size="1" maxWidth="240px">
        <Dialog.Title size="2">gift a fish</Dialog.Title>
        <Flex direction="column" gap="1">
          {inventory.length === 0 ? (
            <Text size="1" color="gray">
              the cooler is empty
            </Text>
          ) : (
            inventory.map((item, i) => (
              <Code
                key={i}
                size="1"
                color={RARITY_COLOR[item.rarity]}
                className={
                  item.rarity === Rarity.LEGENDARY
                    ? "rarity-legendary"
                    : undefined
                }
                onClick={() => handleGift(i)}
                style={{ cursor: "pointer" }}
              >
                {item.fish.name}
              </Code>
            ))
          )}
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
