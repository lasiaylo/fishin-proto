import React, { useEffect, useRef } from "react";
import { Flex } from "@radix-ui/themes";
import { FightState, Phase } from "../game/FightEngine";
import { MyButton } from "./MyButton";
import { StatBar } from "./StatBar";

const STRUGGLE_COLOR = "hsl(0 80% 55% / 0.49)";

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
    <Flex direction="row" flexGrow={"1"} gap="5" width={"100%"}>
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
        <MyButton disabled={!onReelStart} minWidth={100}>
          reel
        </MyButton>
      </div>

      <Flex
        position={"relative"}
        flexGrow={"1"}
        direction="column"
        gap="4"
        className={"fade-in"}
        style={{ opacity: fading ? 0 : 1, transition: "opacity 0.6s ease" }}
      >
        <StatBar
          label="distance"
          value={distance}
          max={100}
          progressColor={
            fightState?.phase === Phase.STRUGGLE ? STRUGGLE_COLOR : undefined
          }
        />
        {fightState && (
          <StatBar
            label="hp"
            value={lineHp - fightState.tension}
            max={lineHp}
          />
        )}
      </Flex>
    </Flex>
  );
}
