import React, { useEffect, useRef } from "react";
import { Flex } from "@radix-ui/themes";
import { FightState, Phase } from "../game/FightEngine";
import { MyButton } from "./MyButton";
import { StatBar } from "./StatBar";

const STRUGGLE_COLOR = "hsl(0 80% 55% / 0.49)";

// The reel button and the stat bars are separate components so PondView can
// keep the button in the same spot as the cast button (under the rod/tackle
// selects) while the bars grow upward in their own column.

interface ReelButtonProps {
  onReelStart?: () => void;
  onReelEnd?: () => void;
}

export function ReelButton({ onReelStart, onReelEnd }: ReelButtonProps) {
  const isPointerDown = useRef(false);

  useEffect(() => {
    if (onReelStart && isPointerDown.current) {
      onReelStart();
    }
  }, [onReelStart]);

  return (
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
  );
}

interface ReelBarsProps {
  distance: number;
  fightState?: FightState | null;
  lineHp: number;
  fading?: boolean;
}

export function ReelBars({
  distance,
  fightState,
  lineHp,
  fading = false,
}: ReelBarsProps) {
  return (
    <Flex
      position={"relative"}
      flexGrow={"1"}
      minWidth={"240px"}
      direction="column"
      gap="4"
      className={"fade-in"}
      style={{ opacity: fading ? 0 : 1, transition: "opacity 0.6s ease" }}
    >
      {/* hp sits above distance so distance stays put (bars are
          bottom-aligned) when the fight starts. */}
      {fightState && (
        <StatBar label="hp" value={lineHp - fightState.tension} max={lineHp} />
      )}
      <StatBar
        label="distance"
        value={distance}
        max={100}
        progressColor={
          fightState?.phase === Phase.STRUGGLE ? STRUGGLE_COLOR : undefined
        }
      />
    </Flex>
  );
}
