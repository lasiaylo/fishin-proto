import React, { useEffect, useState } from "react";
import { Button, Flex, Text } from "@radix-ui/themes";
import { pushEvent } from "../stores/eventLogStore";
import { usePlayer } from "../stores/playerStore";
import { getAvailableFish } from "../stores/fishStore";
import { addFish, isFull } from "../stores/inventoryStore";
import { FightCanvas } from "./FightCanvas";
import { FishData } from "../util/csvLoader";

// ── Spot definitions ──

interface FishingSpot {
  label: string;
}

const FISHING_SPOTS: FishingSpot[] = [
  { label: "Shallow End" },
  { label: "Deep End" },
  { label: "Far End" },
];

function getFishForSpot(_spot: FishingSpot): FishData[] {
  return getAvailableFish();
}

function pickRandomFish(fish: FishData[]): FishData {
  return fish[Math.floor(Math.random() * fish.length)];
}

// ── States ──

type PondState =
  | { kind: "idle" }
  | { kind: "casting"; spot: FishingSpot }
  | { kind: "biting"; spot: FishingSpot; fish: FishData }
  | { kind: "fighting"; fish: FishData }
  | { kind: "result"; outcome: "WIN" | "LOSE"; fish: FishData };

// ── Component ──

export function PondView() {
  const [state, setState] = useState<PondState>({ kind: "idle" });
  const [isReeling, setIsReeling] = useState(false);
  const { reelStrength, drag, lineStrength } = usePlayer();

  function onCast(spot: FishingSpot) {
    if (isFull()) {
      pushEvent("Inventory is full! Sell fish at the shop first.");
      return;
    }

    const pool = getFishForSpot(spot);
    if (pool.length === 0) {
      pushEvent(`No fish available at the ${spot.label}.`);
      return;
    }

    pushEvent(`Cast line into the ${spot.label.toLowerCase()}...`);
    setState({ kind: "casting", spot });
  }

  // Casting wait → bite
  useEffect(() => {
    if (state.kind !== "casting") return;

    const delay = 1000 + Math.random() * 2000;
    const timeout = setTimeout(() => {
      const fish = pickRandomFish(getFishForSpot(state.spot));
      setState({ kind: "biting", spot: state.spot, fish });
    }, delay);

    return () => clearTimeout(timeout);
  }, [state]);

  // Biting → 2s window to hook
  useEffect(() => {
    if (state.kind !== "biting") return;

    const timeout = setTimeout(() => {
      pushEvent("Too slow! The fish got away...");
      setState({ kind: "idle" });
    }, 2000);

    return () => clearTimeout(timeout);
  }, [state]);

  function onHook() {
    if (state.kind !== "biting") return;
    pushEvent(`A ${state.fish.name} is on the line!`);
    setState({ kind: "fighting", fish: state.fish });
  }

  function onFightEnd(outcome: "WIN" | "LOSE") {
    if (state.kind !== "fighting") return;
    const fish = state.fish;

    if (outcome === "WIN") {
      addFish({ name: fish.name, basePrice: fish.basePrice });
      pushEvent(`Caught a ${fish.name}!`);
    } else {
      pushEvent(`The ${fish.name} got away...`);
    }

    setState({ kind: "result", outcome, fish });
  }

  // Result screen → idle after 2s
  useEffect(() => {
    if (state.kind !== "result") return;

    const timeout = setTimeout(() => {
      setState({ kind: "idle" });
    }, 2000);

    return () => clearTimeout(timeout);
  }, [state]);

  // Shared action callbacks for button + spacebar
  function onActionDown() {
    if (state.kind === "biting") onHook();
    if (state.kind === "fighting") setIsReeling(true);
  }

  function onActionUp() {
    if (state.kind === "fighting") setIsReeling(false);
  }

  // Spacebar mirrors the action button
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.code !== "Space" || e.repeat) return;
      e.preventDefault();
      onActionDown();
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.code !== "Space") return;
      onActionUp();
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [state]);

  // ── Render ──

  const actionDisabled =
    state.kind === "idle" || state.kind === "casting" || state.kind === "result";
  const actionLabel =
    state.kind === "biting"
      ? "Hook!"
      : state.kind === "fighting"
        ? "Reel!"
        : "Action";

  return (
    <Flex p="4" direction="column" gap="3">
      <div style={{ minHeight: 340 }}>
        {state.kind === "idle" && (
          <Flex gap="3" wrap="wrap">
            {FISHING_SPOTS.map((spot) => (
              <Button
                key={spot.label}
                variant="outline"
                onClick={() => onCast(spot)}
              >
                Fish {spot.label}
              </Button>
            ))}
          </Flex>
        )}

        {state.kind === "casting" && (
          <Flex direction="column" gap="3" align="center">
            <Text size="4">Waiting for a bite...</Text>
          </Flex>
        )}

        {state.kind === "biting" && (
          <Flex direction="column" gap="3" align="center">
            <Text size="5" weight="bold">
              Bite!
            </Text>
          </Flex>
        )}

        {state.kind === "result" && (
          <Flex direction="column" gap="3" align="center">
            <Text size="5" weight="bold">
              {state.outcome === "WIN"
                ? `Caught a ${state.fish.name}!`
                : `The ${state.fish.name} got away...`}
            </Text>
          </Flex>
        )}

        {state.kind === "fighting" && (
          <>
            <FightCanvas
              fishSpeed={state.fish.speed}
              fishStrength={state.fish.strength}
              reelStr={reelStrength}
              drag={drag}
              lineHp={lineStrength}
              isReeling={isReeling}
              onEnd={onFightEnd}
            />
          </>
        )}
      </div>

      {/* Persistent action button */}
      <Button
        size="3"
        disabled={actionDisabled}
        onMouseDown={onActionDown}
        onMouseUp={onActionUp}
        onMouseLeave={onActionUp}
      >
        {actionLabel}
      </Button>
    </Flex>
  );
}
