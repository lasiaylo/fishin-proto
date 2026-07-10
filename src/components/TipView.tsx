import { Code, Flex, Text, Tooltip } from "@radix-ui/themes";
import React from "react";
import { useFriend } from "../stores/friendStore";
import { useTipData } from "../stores/tipStore";

export function TipView() {
  const collectedTipIds = useFriend((s) => s.collectedTipIds);
  const tipData = useTipData((s) => s.tipData);

  if (collectedTipIds.length === 0) return null;

  return (
    <Flex direction="column" gap="1">
      <Text size="1" color="gray">
        tips
      </Text>
      <Flex direction="column" gap="1">
        {collectedTipIds.map((id) => {
          const tip = tipData.find((t) => t.id === id);
          if (!tip) return null;
          return (
            <Tooltip key={id} content={tip.text} maxWidth="200px">
              <Code size="1" color="gray">
                {tip.title}
              </Code>
            </Tooltip>
          );
        })}
      </Flex>
    </Flex>
  );
}
