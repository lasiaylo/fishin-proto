import { Flex, HoverCard, Separator, Text } from "@radix-ui/themes";
import React, { useEffect, useState } from "react";
import {
  acceptGift,
  ignoreGift,
  isGiftAvailable,
  useFriend,
} from "../stores/friendStore";
import { GIFT_COOLDOWN_MS, NPC_ACTIVITY_DUMMY } from "../util/constants";
import { GiftDialog } from "./GiftDialog";
import { MyButton } from "./MyButton";

function GiftAvailability({ name }: { name: string }) {
  const lastGiftedAt = useFriend((s) => s.lastGiftedAt[name]);
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  if (isGiftAvailable(name)) {
    return (
      <Text size="1" color="grass">
        gift available
      </Text>
    );
  }

  const remainingMs = GIFT_COOLDOWN_MS - (Date.now() - (lastGiftedAt ?? 0));
  const remainingSec = Math.max(0, Math.ceil(remainingMs / 1000));
  const mins = Math.floor(remainingSec / 60);
  const secs = remainingSec % 60;

  return (
    <Text size="1" color="gray">
      gift available in {mins}m {secs}s
    </Text>
  );
}

export function ChatroomView() {
  const chatroom = useFriend((s) => s.chatroom);
  const pendingGift = useFriend((s) => s.pendingGift);
  const [giftDialogName, setGiftDialogName] = useState<string | null>(null);

  if (chatroom.length === 0) return null;

  return (
    <Flex direction="column" gap="3" width="200px">
      <Separator size={"4"} />
      <Text size={"1"} style={{ textDecoration: "underline" }}>
        the pond
      </Text>
      <Flex direction="column" gap="1">
        {chatroom.map((name) => (
          <HoverCard.Root key={name}>
            <HoverCard.Trigger>
              <Text className="fade-in" size="1" color="gray">
                {name}
              </Text>
            </HoverCard.Trigger>
            <HoverCard.Content size="1" maxWidth="200px">
              <Flex direction="column" gap="2">
                <Text size="1" color="gray">
                  {NPC_ACTIVITY_DUMMY}
                </Text>
                <GiftAvailability name={name} />
                <MyButton onClick={() => setGiftDialogName(name)}>
                  gift
                </MyButton>
              </Flex>
            </HoverCard.Content>
          </HoverCard.Root>
        ))}
      </Flex>

      {pendingGift && (
        <Flex
          direction="column"
          gap="2"
          p="2"
          style={{ border: "1px solid var(--gray-8)" }}
        >
          <Text size="1" color="gray">
            big ghost sent a gift
          </Text>
          <Flex gap="2">
            <MyButton onClick={acceptGift}>accept</MyButton>
            <MyButton onClick={ignoreGift}>ignore</MyButton>
          </Flex>
        </Flex>
      )}

      <GiftDialog
        npcName={giftDialogName}
        onClose={() => setGiftDialogName(null)}
      />
    </Flex>
  );
}
