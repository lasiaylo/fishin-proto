import React from "react";
import { Flex, Progress, Text } from "@radix-ui/themes";
import { FightState } from "../game/FightEngine";
// @ts-ignore
import { progressPropDefs } from "@radix-ui/themes/props";
import { MyButton } from "./MyButton";

function StatBar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: progressPropDefs.color;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <Flex direction="column" gap="1">
      <Flex justify="between">
        <Text size="1" color="gray">
          {label}
        </Text>
        <Text size="1" color="gray">
          {value.toFixed(1)} / {max}
        </Text>
      </Flex>
      <Progress radius={"none"} value={pct} color={color} size="3" />
    </Flex>
  );
}

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
      <StatBar label="lure distance" value={distance} max={100} color="cyan" />
      <StatBar
        label="line hp"
        value={lineHp - tension}
        max={lineHp}
        color="red"
      />
    </Flex>
  );
}
