import React, { useEffect, useRef, useState } from "react";
import { Flex, Text } from "@radix-ui/themes";
import { MyButton } from "./MyButton";
import { FishData } from "../util/csvLoader";
import { getAvailableFish } from "../stores/fishStore";
import { addMoney, usePlayer } from "../stores/playerStore";
import { pushEvent } from "../stores/eventLogStore";
import { EventMsg } from "../util/eventMessages";
import { FightEngine, FightState, Outcome } from "../game/FightEngine";
import { randomRange } from "../util/random";
import { FightView } from "./FightView";

enum GameState {
  Idle = "idle",
  Luring = "luring",
  Missed = "missed",
  Fighting = "fighting",
}

const SPOTS = ["Shallow End", "Deep End", "Far End"] as const;
// const BITE_DELAY: [number, number] = [2, 8];
const BITE_DELAY: [number, number] = [0, 0];
const HOOK_WINDOW = 2;
const RESULT_DURATION = 1000;

export function PondView() {
  const [gameState, setGameState] = useState<GameState>(GameState.Idle);
  const [biteReady, setBiteReady] = useState(false);
  const [fading, setFading] = useState(false);
  const [fightState, setFightState] = useState<FightState | null>(null);

  const caughtFishRef = useRef<FishData | null>(null);
  const fightRef = useRef<FightEngine | null>(null);
  const lineHpRef = useRef<number>(0);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number | null>(null);
  const reelRef = useRef<boolean>(false);
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
    function handleKey(e: KeyboardEvent) {
      if (e.key !== "1") return;
      caughtFishRef.current = {
        id: "debug",
        name: "Debug Fish",
        basePrice: 0,
        attack: 5,
        defense: 5,
        thrash: 5,
        requiredLure: "none",
      };
      startFight();
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  function scheduleBite() {
    const delay = randomRange(BITE_DELAY[0], BITE_DELAY[1]) * 1000;
    biteTimerRef.current = setTimeout(() => {
      setBiteReady(true);
      pushEvent(EventMsg.BITING);
      hookWindowRef.current = setTimeout(() => {
        setBiteReady(false);
        pushEvent(EventMsg.ESCAPED);
        setGameState(GameState.Missed);
      }, HOOK_WINDOW * 1000);
    }, delay);
  }

  function startFight() {
    if (biteTimerRef.current !== null) clearTimeout(biteTimerRef.current);
    if (hookWindowRef.current !== null) clearTimeout(hookWindowRef.current);
    setBiteReady(false);
    setGameState(GameState.Fighting);

    const { attack, defense, lineHP } = usePlayer.getState();
    const fish = caughtFishRef.current!;
    lineHpRef.current = lineHP;

    fightRef.current = new FightEngine(
      fish.attack,
      fish.defense,
      fish.thrash,
      attack,
      defense,
      lineHP,
    );

    pushEvent(EventMsg.HOOKED(fish.name));
    lastTimeRef.current = null;

    function loop(timestamp: number) {
      if (lastTimeRef.current === null) lastTimeRef.current = timestamp;
      const dt = Math.min((timestamp - lastTimeRef.current) / 1000, 0.1);
      lastTimeRef.current = timestamp;

      const state = fightRef.current!.tick(dt, reelRef.current);
      setFightState({ ...state });
      if (state.outcome !== null) {
        console.log("Finished!", state.outcome, state.time);
        finishFight(state.outcome!);
        return;
      }
      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);
  }

  function finishFight(result: Outcome) {
    cancelAnimationFrame(rafRef.current);
    const fish = caughtFishRef.current!;

    if (result === Outcome.WIN) {
      addMoney(fish.basePrice);
      pushEvent(EventMsg.CAUGHT(fish.name, fish.basePrice));
    } else {
      pushEvent(EventMsg.GOT_AWAY(fish.name));
    }

    setFading(true);
    setTimeout(() => {
      setGameState(GameState.Idle);
      setFading(false);
    }, RESULT_DURATION);
  }

  function handleSpotClick(spot: string) {
    const fish = getAvailableFish();
    if (fish.length === 0) {
      pushEvent(EventMsg.NO_FISH);
      return;
    }
    caughtFishRef.current = fish[Math.floor(Math.random() * fish.length)];
    pushEvent(EventMsg.CASTING(spot));
    setGameState(GameState.Luring);
    setBiteReady(false);
    scheduleBite();
  }

  if (gameState === GameState.Idle) {
    return (
      <Flex className="fade-in" direction="column" gap="3" p="4">
        <Text size={"1"}>Choose a fishing spot</Text>
        {SPOTS.map((spot) => (
          <MyButton key={spot} onClick={() => handleSpotClick(spot)}>
            {spot}
          </MyButton>
        ))}
      </Flex>
    );
  }

  if (gameState === GameState.Fighting && fightState !== null) {
    return (
      <FightView
        state={fightState}
        lineHp={lineHpRef.current}
        fading={fading}
        onReelStart={() => {
          reelRef.current = true;
        }}
        onReelEnd={() => {
          reelRef.current = false;
        }}
      />
    );
  }

  let message;
  let onClick;

  if (gameState === GameState.Missed) {
    onClick = () => setGameState(GameState.Idle);
    message = "Return";
  } else {
    onClick = () => {
      if (biteReady) {
        startFight();
        return;
      }
      if (biteTimerRef.current !== null) clearTimeout(biteTimerRef.current);
      if (hookWindowRef.current !== null) clearTimeout(hookWindowRef.current);
      setGameState(GameState.Idle);
    };
    message = biteReady ? "Hook" : "Reel";
  }

  return (
    <Flex direction="column" gap="4" p="4" justify="start">
      <MyButton onClick={onClick}>{message}</MyButton>
    </Flex>
  );
}
