import React, { useEffect } from "react";
import { Flex, Text } from "@radix-ui/themes";
import { ActionState, useAction } from "../stores/actionStore";
import { BUTTON_STYLE, getFillBackgroundStyle } from "./styleConstants";
import { triggerActionSlot, useCooldown } from "../stores/cooldownStore";

export function HomeView() {
  return <></>;
  return (
    <Flex justify={"center"} gap={"3"}>
      {Array(1)
        .fill(null)
        .map((_, i) => (
          <HomeButton key={i} idx={i} />
        ))}
    </Flex>
  );
}

const ACTION_BAR_BUTTON_SIZE = "50px";

function HomeButton({ idx }: { idx: number }) {
  const { actionT, elapsed } = useCooldown((s) => s[idx]);
  const { cooldown } = useAction((s: ActionState) => s[actionT]);
  const e = elapsed ?? 1;
  const c = elapsed === undefined ? e : (cooldown ?? e);
  const p = (1 - e / c) * 100;
  const progress = p === 100 ? 0 : p;

  const onClick = () => triggerActionSlot(idx);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === `${idx + 1}`) onClick();
    };
    window.addEventListener("keydown", fn);
    return () => {
      window.removeEventListener("keydown", fn);
    };
  }, []);

  const opacity = progress === 0 ? 1 : 0.2;

  return (
    <button
      onClick={onClick}
      style={{
        ...BUTTON_STYLE,
        ...getFillBackgroundStyle(progress),
        position: "relative",
        width: ACTION_BAR_BUTTON_SIZE,
        height: ACTION_BAR_BUTTON_SIZE,
      }}
    >
      <Text
        style={{
          opacity,
          margin: 0,
          position: "absolute",
          right: "0",
          marginRight: "4px",
        }}
        size={"1"}
      >
        {idx + 1}
      </Text>
      <Flex
        style={{
          opacity,
        }}
        width="100%"
        height={"100%"}
        justify={"center"}
        align={"center"}
      >
        🍞
      </Flex>
    </button>
  );
}
