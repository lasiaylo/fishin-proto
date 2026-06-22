import React from "react";
import { Flex, Progress, Text } from "@radix-ui/themes";
// @ts-ignore
import { progressPropDefs } from "@radix-ui/themes/props";

export function StatBar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color?: progressPropDefs.color;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <Flex direction="column" gap="1">
      <Flex justify="between">
        <Text size="1" color="gray">
          {label}
        </Text>
        <Text size="1" color="gray">
          {Math.ceil(value)} / {Math.ceil(max)}
        </Text>
      </Flex>
      <Progress radius={"none"} value={pct} color={color} size="3" />
    </Flex>
  );
}
