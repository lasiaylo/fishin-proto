import React from "react";
import { Flex, Progress, Text } from "@radix-ui/themes";
import { Phase, FightState } from "../game/FightEngine";

const PHASE_LABEL: Record<Phase, string> = {
  [Phase.REST]: "REST",
  [Phase.STRUGGLE]: "STRUGGLE",
  [Phase.SUPER_STRUGGLE]: "SUPER ATTACK",
};

const PHASE_COLOR = {
  [Phase.REST]: "green",
  [Phase.STRUGGLE]: "amber",
  [Phase.SUPER_STRUGGLE]: "red",
} as const;

interface FightViewProps {
  state: FightState;
  lineHp: number;
  fishName: string;
}

export function FightView({ state, lineHp, fishName }: FightViewProps) {
  const { distance, tension, phase } = state;
  const tensionPct = lineHp > 0 ? Math.min(100, (tension / lineHp) * 100) : 0;

  return (
    <Flex direction="column" gap="4" p="4">
      <Text size="2" align="center" color="gray">
        {fishName}
      </Text>
      <Text size="3" weight="bold" align="center" color={PHASE_COLOR[phase]}>
        {PHASE_LABEL[phase]}
      </Text>

      <Flex direction="column" gap="1">
        <Flex justify="between">
          <Text size="1" color="gray">Fish Distance</Text>
          <Text size="1" color="gray">{distance.toFixed(1)} / 100</Text>
        </Flex>
        <Progress value={distance} color="blue" size="3" />
      </Flex>

      <Flex direction="column" gap="1">
        <Flex justify="between">
          <Text size="1" color="gray">Line Tension</Text>
          <Text size="1" color="gray">{tension.toFixed(1)} / {lineHp}</Text>
        </Flex>
        <Progress value={tensionPct} color="red" size="3" />
      </Flex>
    </Flex>
  );
}
