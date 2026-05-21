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

function StatBar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: "blue" | "red";
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <Flex direction="column" gap="1">
      <Flex justify="between">
        <Text size="1" color="gray">{label}</Text>
        <Text size="1" color="gray">{value.toFixed(1)} / {max}</Text>
      </Flex>
      <Progress value={pct} color={color} size="3" />
    </Flex>
  );
}

interface FightViewProps {
  state: FightState;
  lineHp: number;
  fishName: string;
  fading?: boolean;
}

export function FightView({ state, lineHp, fishName, fading = false }: FightViewProps) {
  const { distance, tension, phase } = state;

  return (
    <Flex
      direction="column"
      gap="4"
      p="4"
      style={{ opacity: fading ? 0 : 1, transition: "opacity 0.6s ease" }}
    >
      <Flex justify="between" align="center">
        <Text size="2" color="gray">{fishName}</Text>
        <Text size="2" weight="bold" color={PHASE_COLOR[phase]}>{PHASE_LABEL[phase]}</Text>
      </Flex>
      <StatBar label="Fish Distance" value={distance} max={100} color="blue" />
      <StatBar label="Line Tension" value={tension} max={lineHp} color="red" />
    </Flex>
  );
}
