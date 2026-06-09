import React, { useEffect, useRef, useState } from "react";
import { Flex, Text } from "@radix-ui/themes";
import { MyButton } from "./MyButton";
import { FishData, StatName } from "../util/csvLoader";
import { useFish } from "../stores/fishStore";
import {
  LocationEntry,
  pickFishAtSpot,
  useLocation,
} from "../stores/locationStore";
import {
  addFishToInventory,
  setSelectedLure,
  usePlayer,
} from "../stores/playerStore";
import { randomizeFishStats } from "../stores/fishStore";
import { useShop } from "../stores/shopStore";
import { pushEvent } from "../stores/eventLogStore";
import { EventMsg } from "../util/eventMessages";
import { FightEngine, FightState, Outcome } from "../game/FightEngine";
import { useSessionLog } from "../stores/sessionLogStore";
import { randomRange } from "../util/random";
import { FightView } from "./FightView";

enum GameState {
  Idle = "idle",
  Luring = "luring",
  Missed = "missed",
  Fighting = "fighting",
}

const BITE_DELAY: [number, number] = [2, 6];
const HOOK_WINDOW = 2;
const RESULT_DURATION = 1000;

export function PondView() {
  const locations = useLocation();
  const invCount = usePlayer((s) => s.inventory.length);
  const inventorySize = usePlayer((s) => s.inventorySize);
  const ownedLures = usePlayer((s) => s.ownedLures);
  const shopUpgrades = useShop((s) => s.upgrades);
  const selectedLure = usePlayer((s) => s.selectedLure);
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
  const prevCritRef = useRef<boolean>(false);
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
    const lures = shopUpgrades.filter(
      (u) => u.stat === StatName.LURE && ownedLures.has(u.id),
    );
    const last = lures[lures.length - 1];
    setSelectedLure(last?.id ?? null);
  }, [ownedLures, shopUpgrades]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const digit = parseInt(e.key);
      if (digit >= 1 && digit <= 7) {
        const fish = useFish.getState().allFish[digit - 1];
        if (fish) {
          caughtFishRef.current = randomizeFishStats(fish);
          startFight();
        }
      }
      if (e.key === "=") {
        addFishToInventory(useFish.getState().allFish[0]);
      }
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

    pushEvent(EventMsg.HOOKED());
    lastTimeRef.current = null;
    prevCritRef.current = false;

    function loop(timestamp: number) {
      if (lastTimeRef.current === null) lastTimeRef.current = timestamp;
      const dt = Math.min((timestamp - lastTimeRef.current) / 1000, 0.1);
      lastTimeRef.current = timestamp;

      const state = fightRef.current!.tick(dt, reelRef.current);
      if (state.crit && !prevCritRef.current) pushEvent(EventMsg.CRIT);
      prevCritRef.current = state.crit;
      setFightState({ ...state });
      if (state.outcome !== null) {
        console.log(
          state.outcome,
          caughtFishRef.current?.name,
          caughtFishRef.current?.attack.toFixed(2),
          caughtFishRef.current?.defense.toFixed(2),
          +state.time.toFixed(2),
        );
        finishFight(state.outcome!, state);
        return;
      }
      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);
  }

  function finishFight(result: Outcome, finalState: FightState) {
    cancelAnimationFrame(rafRef.current);
    const fish = caughtFishRef.current!;
    const { lineHP, selectedLure } = usePlayer.getState();
    const lureId = selectedLure ?? "";

    useSessionLog
      .getState()
      .logFishResult(
        fish,
        result === Outcome.WIN,
        finalState.time,
        finalState.tension,
        lineHP,
        lureId,
      );

    if (result === Outcome.WIN) {
      addFishToInventory(fish);
      pushEvent(EventMsg.CAUGHT(fish.name));
    } else {
      pushEvent(EventMsg.ESCAPED);
    }

    setFading(true);
    setTimeout(() => {
      setGameState(GameState.Idle);
      setFading(false);
    }, RESULT_DURATION);
  }

  function handleSpotClick(spotId: string, spot: LocationEntry) {
    const fish = pickFishAtSpot(spotId);
    if (!fish) {
      pushEvent(EventMsg.NO_FISH);
      return;
    }
    caughtFishRef.current = fish;
    pushEvent(EventMsg.CASTING(spot.name));
    setGameState(GameState.Luring);
    setBiteReady(false);
    scheduleBite();
  }

  if (gameState === GameState.Idle) {
    if (invCount >= inventorySize) {
      return (
        <Flex className="fade-in" direction="column" gap="3" p="4">
          <Text size={"1"}>The cooler is full.</Text>
        </Flex>
      );
    }
    const ownedLureList = shopUpgrades.filter(
      (u) => u.stat === StatName.LURE && ownedLures.has(u.id),
    );
    return (
      <Flex className="fade-in" direction="column" gap="3" p="4">
        <Flex direction="column" gap="2">
          <Text size="1">lure</Text>
          <select
            value={selectedLure ?? ""}
            onChange={(e) => setSelectedLure(e.target.value || null)}
          >
            <option value="">none</option>
            {ownedLureList.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </Flex>

        <Text size={"1"} mt={"4"}>
          choose a fishing spot
        </Text>
        {Object.entries(locations).map(([id, loc]) => (
          <MyButton key={id} onClick={() => handleSpotClick(id, loc)}>
            {loc.name}
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
    message = "go back";
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
    message = biteReady ? "hook" : "reel";
  }

  return (
    <Flex direction="column" gap="4" p="4" justify="start">
      <MyButton onClick={onClick}>{message}</MyButton>
    </Flex>
  );
}
