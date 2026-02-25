import React from "react";
import {
  ProduceT,
  setFocus,
  useFocusedProduce,
  useProduce,
} from "../stores/produceStore";
import { Box, Flex, Separator, Text } from "@radix-ui/themes";
import {
  BUTTON_STYLE,
  getFillBackgroundStyle,
  GRAY,
  LIGHT_ORANGE,
  ORANGE,
} from "./styleConstants";
import { HoverButton } from "./HoverButton";

export const DEFAULT_FOCUS = "Unassigned";

export function ProduceView() {
  const { focus, produce, progress } = useFire();
  let focusText = <Text>{DEFAULT_FOCUS}</Text>;
  if (produce) {
    focusText = (
      <Flex gap={"2"} justify={"center"}>
        <Flex>{focus}</Flex>
        <Box
          width={"70px"}
        >{`${Math.floor(produce.progress)} / ${produce.requirement}`}</Box>
      </Flex>
    );
  }
  return (
    <Flex direction={"column"} align={"center"} gapY={"3"}>
      <Flex
        justify={"center"}
        style={{
          borderRadius: "var(--radius-3)",
          borderColor: focus ? ORANGE : GRAY,
          borderWidth: "1px",
          borderStyle: "solid",
          width: "100%",
          ...getFillBackgroundStyle(progress, LIGHT_ORANGE),
        }}
      >
        {focusText}
      </Flex>
      <Separator size={"4"} />
      {Object.values(ProduceT).map((type) => (
        <FireButton
          key={type}
          type={type}
          isSelected={focus === type}
          onSelect={() => setFocus(focus === type ? undefined : type)}
        />
      ))}
    </Flex>
  );
}

function FireButton({
  type,
  isSelected,
  onSelect,
}: {
  type: ProduceT;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const unlocked = useProduce((s) => s[type].unlocked);
  const { requirement, flavor, effect, amount, capacity } = useProduce(
    (s) => s[type],
  );
  const borderColor = isSelected ? ORANGE : GRAY;
  const p = (amount / capacity) * 100;
  return (
    <HoverButton
      onClick={onSelect}
      label={`${type} | 🔥 ${requirement}`}
      style={{
        borderColor: borderColor,
      }}
      isVisible={unlocked}
      gameAction={{
        flavor: flavor,
        effect: effect,
      }}
    >
      <Flex
        width={"100%"}
        style={{
          ...BUTTON_STYLE,
          ...getFillBackgroundStyle(p, LIGHT_ORANGE),
        }}
        justify={"center"}
        mt={"1"}
      >
        <Text size={"1"}>{`${amount} / ${capacity}`}</Text>
      </Flex>
    </HoverButton>
  );
}

export function useFire() {
  const focus = useFocusedProduce((s) => s.focus);
  const produce = useProduce((s) => {
    if (focus === null) return;
    return s[focus];
  });

  let p = 0;
  if (produce) {
    p = ((produce.progress ?? 0) / (produce.requirement ?? 0)) * 100;
  }
  return {
    focus,
    produce,
    progress: p,
  };
}
