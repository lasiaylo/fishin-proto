import { Flex, HoverCard, Separator, Text } from "@radix-ui/themes";
import React from "react";
import { acceptGift, ignoreGift, useFriend } from "../stores/friendStore";
import { NPC_ACTIVITY_DUMMY } from "../util/constants";
import { MyButton } from "./MyButton";

export function ChatroomView() {
  const chatroom = useFriend((s) => s.chatroom);
  const pendingGift = useFriend((s) => s.pendingGift);

  if (chatroom.length === 0) return null;

  return (
    <Flex direction="column" gap="3" width="200px">
      <Separator size={"4"} />
      <Text size={"1"}>the pond</Text>
      <Flex direction="column" gap="1">
        {chatroom.map((name) => (
          <HoverCard.Root key={name}>
            <HoverCard.Trigger>
              <Text
                className="fade-in"
                size="1"
                color="gray"
                style={{ textDecoration: "underline" }}
              >
                {name}
              </Text>
            </HoverCard.Trigger>
            <HoverCard.Content size="1" maxWidth="200px">
              <Text size="1" color="gray">
                {NPC_ACTIVITY_DUMMY}
              </Text>
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
    </Flex>
  );
}
