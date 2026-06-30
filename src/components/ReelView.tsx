import React, { useEffect, useRef } from "react";
import { Box, Flex, Text } from "@radix-ui/themes";
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
  const isPointerDown = useRef(false);

  useEffect(() => {
    if (onReelStart && isPointerDown.current) {
      onReelStart();
    }
  }, [onReelStart]);

  return (
    <Flex direction="column" flexGrow={"1"} gap="4">
      <Flex gap={"4"} align={"center"}>
        <div
          onPointerDown={() => {
            isPointerDown.current = true;
            if (onReelStart) onReelStart();
          }}
          onPointerUp={() => {
            isPointerDown.current = false;
            if (onReelEnd) onReelEnd();
          }}
          onPointerLeave={() => {
            if (isPointerDown.current) {
              isPointerDown.current = false;
              if (onReelEnd) onReelEnd();
            }
          }}
        >
          <MyButton disabled={!onReelStart} minWidth={150}>
            reel
          </MyButton>
        </div>
        <Text size="2" color="gray">
          {fightState?.phase ?? " "}
        </Text>
      </Flex>
      <Flex
        position={"relative"}
        direction="column"
        gap="4"
        className={"fade-in"}
        style={{ opacity: fading ? 0 : 1, transition: "opacity 0.6s ease" }}
      >
        <StatBar label="distance" value={distance} max={100} />
        <StatBar
          label="hp"
          value={lineHp - (fightState?.tension ?? 0)}
          max={lineHp}
        />
      </Flex>
    </Flex>
  );
}
