import React from "react";
import { Flex, Text } from "@radix-ui/themes";
import { FightState } from "../game/FightEngine";
import { MyButton } from "./MyButton";
import { StatBar } from "./StatBar";

interface FightViewProps {
  state: FightState;
  lineHp: number;
  fading?: boolean;
  onReelStart: () => void;
  onReelEnd: () => void;
}

export function FightView({
  state,
  lineHp,
  fading = false,
  onReelStart,
  onReelEnd,
}: FightViewProps) {
  const { distance, tension, phase } = state;

  return (
    <Flex
      direction="column"
      width={"100%"}
      gap="4"
      p="4"
      style={{ opacity: fading ? 0 : 1, transition: "opacity 0.6s ease" }}
    >
      <div
        onMouseDown={onReelStart}
        onMouseUp={onReelEnd}
        onMouseLeave={onReelEnd}
      >
        <MyButton onClick={() => {}}>reel</MyButton>
      </div>
      <Text size="2" color="gray">
        {phase}
      </Text>
      <StatBar label="lure distance" value={distance} max={100} />
      <StatBar label="line hp" value={lineHp - tension} max={lineHp} />
    </Flex>
  );
}
