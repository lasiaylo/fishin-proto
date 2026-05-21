import React, { useEffect, useRef, useState } from "react";
import { Button, Flex, Text } from "@radix-ui/themes";
import { FishData } from "../util/csvLoader";
import { getAvailableFish } from "../stores/fishStore";
import { usePlayer, addMoney } from "../stores/playerStore";
import { pushEvent } from "../stores/eventLogStore";
import { FightEngine, FightState } from "../game/FightEngine";
import { randomRange } from "../util/random";
import { FightView } from "./FightView";

type GameState = "idle" | "luring" | "fighting" | "result";

const SPOTS = ["Shallow End", "Deep End", "Far End"] as const;
const BITE_DELAY: [number, number] = [3, 8];
const HOOK_WINDOW = 2;
const RESULT_DURATION = 2000;

export function PondView() {
  const [gameState, setGameState] = useState<GameState>("idle");
  const [biteReady, setBiteReady] = useState(false);
  const [fishName, setFishName] = useState("");
  const [fishPrice, setFishPrice] = useState(0);
  const [outcome, setOutcome] = useState<"WIN" | "LOSE" | null>(null);
  const [fightState, setFightState] = useState<FightState | null>(null);

  const caughtFishRef = useRef<FishData | null>(null);
  const fightRef = useRef<FightEngine | null>(null);
  const lineHpRef = useRef<number>(0);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number | null>(null);
  const biteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hookWindowRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (biteTimerRef.current !== null) clearTimeout(biteTimerRef.current);
      if (hookWindowRef.current !== null) clearTimeout(hookWindowRef.current);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  useEffect(() => {
    if (gameState !== "luring" || !biteReady) return;
    function handler(e: KeyboardEvent) {
      if (e.code === "Space") {
        e.preventDefault();
        startFight();
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [gameState, biteReady]);

  function scheduleBite() {
    const delay = randomRange(BITE_DELAY[0], BITE_DELAY[1]) * 1000;
    biteTimerRef.current = setTimeout(() => {
      setBiteReady(true);
      hookWindowRef.current = setTimeout(() => {
        setBiteReady(false);
        scheduleBite();
      }, HOOK_WINDOW * 1000);
    }, delay);
  }

  function startFight() {
    if (biteTimerRef.current !== null) clearTimeout(biteTimerRef.current);
    if (hookWindowRef.current !== null) clearTimeout(hookWindowRef.current);
    setBiteReady(false);
    setGameState("fighting");

    const { reelStrength, drag, lineStrength } = usePlayer.getState();
    const fish = caughtFishRef.current!;
    lineHpRef.current = lineStrength;

    fightRef.current = new FightEngine(
      fish.speed,
      fish.strength,
      reelStrength,
      drag,
      lineStrength,
    );

    pushEvent(`Hooked a ${fish.name}!`);
    lastTimeRef.current = null;

    function loop(timestamp: number) {
      if (lastTimeRef.current === null) lastTimeRef.current = timestamp;
      const dt = Math.min((timestamp - lastTimeRef.current) / 1000, 0.1);
      lastTimeRef.current = timestamp;

      const state = fightRef.current!.tick(dt, true);
      setFightState({ ...state });
      if (state.outcome !== null) {
        finishFight(state.outcome as "WIN" | "LOSE");
        return;
      }
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);
  }

  function finishFight(result: "WIN" | "LOSE") {
    cancelAnimationFrame(rafRef.current);
    const fish = caughtFishRef.current!;
    setOutcome(result);
    setGameState("result");

    if (result === "WIN") {
      addMoney(fish.basePrice);
      pushEvent(`Caught a ${fish.name}! +$${fish.basePrice}`);
    } else {
      pushEvent(`The ${fish.name} got away...`);
    }

    if (result === "WIN") {
      setTimeout(() => {
        setGameState("idle");
        setOutcome(null);
      }, RESULT_DURATION);
    }
  }

  function handleSpotClick(spot: string) {
    const fish = getAvailableFish();
    if (fish.length === 0) {
      pushEvent("No fish available to catch!");
      return;
    }
    const selected = fish[Math.floor(Math.random() * fish.length)];
    caughtFishRef.current = selected;
    setFishName(selected.name);
    setFishPrice(selected.basePrice);
    pushEvent(`Casting at ${spot}...`);
    setGameState("luring");
    setBiteReady(false);
    scheduleBite();
  }

  if (gameState === "idle") {
    return (
      <Flex direction="column" gap="3" p="4">
        <Text size="3" weight="bold">Choose a fishing spot</Text>
        <Flex direction="column" gap="2">
          {SPOTS.map((spot) => (
            <Button key={spot} variant="outline" onClick={() => handleSpotClick(spot)}>
              {spot}
            </Button>
          ))}
        </Flex>
      </Flex>
    );
  }

  if (gameState === "result") {
    return (
      <Flex direction="column" gap="4" p="4" align="center" justify="center" style={{ minHeight: 120 }}>
        <Text size="4" weight="bold" align="center">
          {outcome === "WIN"
            ? `Caught a ${fishName}! +$${fishPrice}`
            : `The ${fishName} got away...`}
        </Text>
        {outcome === "LOSE" && (
          <Button variant="outline" onClick={() => { setGameState("idle"); setOutcome(null); }}>
            Return to Pond
          </Button>
        )}
      </Flex>
    );
  }

  if (gameState === "fighting" && fightState !== null) {
    return (
      <FightView
        state={fightState}
        lineHp={lineHpRef.current}
        fishName={fishName}
      />
    );
  }

  return (
    <Flex direction="column" gap="3" p="4" align="center" justify="center" style={{ minHeight: 120 }}>
      <Text size="3" color="gray">
        {biteReady ? "A fish is biting!" : "Waiting for a bite..."}
      </Text>
      <Button variant="outline" disabled={!biteReady} onClick={startFight}>
        {biteReady ? "Hook!" : "Waiting..."}
      </Button>
    </Flex>
  );
}
