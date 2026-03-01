import React, { useEffect, useRef, useState } from "react";
import { Button, Flex, Text } from "@radix-ui/themes";
import { pushEvent } from "../stores/eventLogStore";
import { usePlayer } from "../stores/playerStore";
import { getAvailableFish } from "../stores/fishStore";
import { addFish, isFull } from "../stores/inventoryStore";
import { FightCanvas } from "./FightCanvas";
import { LureCanvas, LureCanvasHandle } from "./LureCanvas";
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
  | { kind: "luring"; spot: FishingSpot; fish: FishData }
  | { kind: "fighting"; fish: FishData }
  | { kind: "result"; outcome: "WIN" | "LOSE"; fish: FishData };

// ── Component ──

export function PondView() {
  const [state, setState] = useState<PondState>({ kind: "idle" });
  const [isReeling, setIsReeling] = useState(false);
  const [isBiting, setIsBiting] = useState(false);
  const lureRef = useRef<LureCanvasHandle>(null);
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

    const fish = pickRandomFish(pool);
    pushEvent(`Cast line into the ${spot.label.toLowerCase()}...`);
    setIsBiting(false);
    setState({ kind: "luring", spot, fish });
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
    if (state.kind === "luring") {
      const result = lureRef.current?.hookAttempt();
      if (result === "bite") {
        pushEvent(`A ${state.fish.name} is on the line!`);
        setState({ kind: "fighting", fish: state.fish });
      } else if (result === "nibble") {
        pushEvent("Too early!");
      }
    }
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

  const actionDisabled = state.kind === "idle" || state.kind === "result";
  const actionLabel =
    state.kind === "luring" && isBiting
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

        {state.kind === "luring" && (
          <LureCanvas ref={lureRef} onBiteChange={setIsBiting} />
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
