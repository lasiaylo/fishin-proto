import React from "react";
import { Flex, Text } from "@radix-ui/themes";
import { MyButton } from "./MyButton";
import { StatBar } from "./StatBar";

interface LuringViewProps {
  distance: number;
  biteReady?: boolean;
  onHook?: () => void;
  onReelIn?: () => void;
}

export function LuringView({
  distance,
  biteReady,
  onHook,
  onReelIn,
}: LuringViewProps) {
  return (
    <Flex direction="column" width={"100%"} gap="4" p="4">
      <MyButton
        disabled={!onReelIn}
        onClick={() => (biteReady ? onHook?.() : onReelIn?.())}
      >
        {biteReady ? "hook" : "reel in"}
      </MyButton>
      <Text size="2" color="gray">
        {" "}
      </Text>
      <StatBar label="distance" value={distance} max={100} />
    </Flex>
  );
}
