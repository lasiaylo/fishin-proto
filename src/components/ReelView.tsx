import React from "react";
import { Flex, Text } from "@radix-ui/themes";
import { FightState } from "../game/FightEngine";
import { MyButton } from "./MyButton";
import { StatBar } from "./StatBar";

interface ReelViewProps {
  distance: number;
  onReelStart?: () => void;
  onReelEnd?: () => void;
  fightState?: FightState | null;
  lineHp: number;
  fading?: boolean;
}

export function ReelView({
  distance,
  onReelStart,
  onReelEnd,
  fightState,
  lineHp,
  fading = false,
}: ReelViewProps) {
  return (
    <Flex
      direction="column"
      width={"100%"}
      gap="4"
      p="4"
      style={{ opacity: fading ? 0 : 1, transition: "opacity 0.6s ease" }}
    >
      <MyButton
        disabled={!onReelStart}
        onMouseDown={onReelStart}
        onMouseUp={onReelEnd}
      >
        reel
      </MyButton>
      <Text size="2" color="gray">
        {fightState?.phase ?? " "}
      </Text>
      <StatBar label="distance" value={distance} max={100} />
      <StatBar
        label="hp"
        value={lineHp - (fightState?.tension ?? 0)}
        max={lineHp}
      />
    </Flex>
  );
}
