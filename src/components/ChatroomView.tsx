import { Flex, Text } from "@radix-ui/themes";
import React from "react";
import { acceptGift, ignoreGift, useFriend } from "../stores/friendStore";
import { getTipById } from "../stores/tipStore";
import { MyButton } from "./MyButton";

export function ChatroomView() {
  const chatroom = useFriend((s) => s.chatroom);
  const pendingGift = useFriend((s) => s.pendingGift);
  const tip = pendingGift ? getTipById(pendingGift.tipId) : undefined;

  return (
    <Flex direction="column" gap="3" width="200px">
      <Flex direction="column" gap="1">
        {chatroom.map((name) => (
          <Text key={name} size="1" color="gray">
            {name}
          </Text>
        ))}
      </Flex>

      {pendingGift && (
        <Flex direction="column" gap="2">
          <Text size="1" color="cyan">
            {tip ? `wants to share a tip: "${tip.title}"` : "has a gift for you"}
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
