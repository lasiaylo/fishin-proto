import React, { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { Flex, Text } from "@radix-ui/themes";
import { MyButton } from "./MyButton";
import { ChargeButton } from "./ChargeButton";
import { FishData, StatName } from "../util/csvLoader";
import { getZones, BITE_CHECK_INTERVAL, getBiteChance } from "../util/zones";
import { randomizeFishStats, useFish } from "../stores/fishStore";
import { pickFishForZone, useLocation } from "../stores/locationStore";
import {
  addFishToInventory,
  setSelectedLure,
  usePlayer,
} from "../stores/playerStore";
import { useShop } from "../stores/shopStore";
import { pushEvent } from "../stores/eventLogStore";
import { EventMsg } from "../util/eventMessages";
import { FightEngine, FightState, Outcome } from "../game/FightEngine";
import { useSessionLog } from "../stores/sessionLogStore";

import { ReelView } from "./ReelView";

enum GameState {
  Idle = "idle",
  CastAnimation = "cast_animation",
  Luring = "luring",
  Fighting = "fighting",
}

export const RESULT_DURATION = 1000;
export const CAST_MIN = 5;
export const CAST_DURATION_MIN = 0.5;
export const CAST_DURATION_MAX = 1.5;
export const CAST_CHARGE_DURATION = 1500;
export const LURING_REEL_MAX_SPEED = 10;
const LURING_REEL_ACCEL = 20;
const LURING_REEL_DECEL = 20;
export const REEL_MIN = 5;

export function PondView() {
  const locations = useLocation();
  const invCount = usePlayer((s) => s.inventory.length);
  const inventorySize = usePlayer((s) => s.inventorySize);
  const ownedLures = usePlayer((s) => s.ownedLures);
  const castMax = usePlayer((s) => s.castMax);
  const shopUpgrades = useShop((s) => s.upgrades);

  const [gameState, setGameState] = useState<GameState>(GameState.Idle);
  const [fading, setFading] = useState(false);
  const [fightState, setFightState] = useState<FightState | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<string>("");
  const [castProgress, setCastProgress] = useState(0);
  const [luringDistance, setLuringDistance] = useState(0);

  const castProgressObjRef = useRef({ value: 0 });
  const castTweenRef = useRef<gsap.core.Tween | null>(null);
  const castLocationRef = useRef<string>("");

  const caughtFishRef = useRef<FishData | null>(null);
  const fightRef = useRef<FightEngine | null>(null);
  const lineHpRef = useRef<number>(usePlayer.getState().lineHP);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number | null>(null);
  const reelRef = useRef<boolean>(false);
  const prevCritRef = useRef<boolean>(false);
  const lastBiteCheckDistanceRef = useRef<number>(0);
  const luringRafRef = useRef<number>(0);
  const luringLastTimeRef = useRef<number | null>(null);
  const luringDistanceRef = useRef<number>(0);
  const isReelingRef = useRef<boolean>(false);
  const luringReelSpeedRef = useRef<number>(0);
  const emptyReelCountRef = useRef(0);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      cancelAnimationFrame(luringRafRef.current);
      castTweenRef.current?.kill();
    };
  }, []);

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

  function checkBite(distance: number): boolean {
    const zones = getZones(distance);
    if (zones.length === 0) return false;
    if (Math.random() > getBiteChance(zones, emptyReelCountRef.current))
      return false;
    const fish = pickFishForZone(castLocationRef.current, zones);
    if (!fish) return false;
    emptyReelCountRef.current = 0;
    caughtFishRef.current = fish;
    pushEvent(EventMsg.BITING);
    startFight();
    return true;
  }

  function startLuringLoop(initialDistance: number) {
    luringDistanceRef.current = initialDistance;
    lastBiteCheckDistanceRef.current = initialDistance;
    luringLastTimeRef.current = null;
    luringReelSpeedRef.current = 0;
    isReelingRef.current = false;

    function loop(timestamp: number) {
      if (luringLastTimeRef.current === null)
        luringLastTimeRef.current = timestamp;
      const dt = Math.min((timestamp - luringLastTimeRef.current) / 1000, 0.1);
      luringLastTimeRef.current = timestamp;

      if (isReelingRef.current) {
        luringReelSpeedRef.current = Math.min(
          luringReelSpeedRef.current + LURING_REEL_ACCEL * dt,
          LURING_REEL_MAX_SPEED,
        );
      } else {
        luringReelSpeedRef.current = Math.max(
          luringReelSpeedRef.current - LURING_REEL_DECEL * dt,
          0,
        );
      }

      if (luringReelSpeedRef.current > 0) {
        luringDistanceRef.current = Math.max(
          0,
          luringDistanceRef.current - luringReelSpeedRef.current * dt,
        );
        setLuringDistance(luringDistanceRef.current);

        if (luringDistanceRef.current <= 0) {
          handleReelIn();
          return;
        }

        if (
          lastBiteCheckDistanceRef.current - luringDistanceRef.current >=
            BITE_CHECK_INTERVAL &&
          initialDistance - luringDistanceRef.current >= REEL_MIN
        ) {
          lastBiteCheckDistanceRef.current = luringDistanceRef.current;
          if (checkBite(luringDistanceRef.current)) return;
        }
      }

      luringRafRef.current = requestAnimationFrame(loop);
    }

    luringRafRef.current = requestAnimationFrame(loop);
  }

  function startFight() {
    cancelAnimationFrame(luringRafRef.current);
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
      luringDistanceRef.current,
      fish.hp,
    );

    pushEvent(EventMsg.HOOKED());
    lastTimeRef.current = null;
    prevCritRef.current = false;
    setFightState({ ...fightRef.current.tick(0, false) });

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
        finishFight(state.outcome, state);
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

    useSessionLog
      .getState()
      .logFishResult(
        fish,
        result === Outcome.WIN,
        finalState.time,
        finalState.tension,
        lineHP,
        selectedLure ?? "",
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

  function handleCastRelease(chargePercent: number) {
    const locationId = selectedLocation || Object.keys(locations)[0];
    const t = chargePercent / 100;
    const castTarget = CAST_MIN + t * (castMax - CAST_MIN);
    castLocationRef.current = locationId;
    pushEvent(EventMsg.CASTING(locations[locationId]?.name ?? locationId));

    castProgressObjRef.current.value = 0;
    setCastProgress(0);
    setGameState(GameState.CastAnimation);

    castTweenRef.current = gsap.to(castProgressObjRef.current, {
      value: castTarget,
      duration: CAST_DURATION_MIN + t * (CAST_DURATION_MAX - CAST_DURATION_MIN),
      ease: "power3.out",
      onUpdate: () => setCastProgress(castProgressObjRef.current.value),
      onComplete: () => {
        setGameState(GameState.Luring);
        setLuringDistance(castTarget);
        startLuringLoop(castTarget);
      },
    });
  }

  function handleReelIn() {
    cancelAnimationFrame(luringRafRef.current);
    emptyReelCountRef.current += 1;
    setGameState(GameState.Idle);
  }

  if (gameState === GameState.Idle) {
    if (invCount >= inventorySize) {
      return (
        <Flex className="fade-in" direction="column" gap="3" p="4">
          <Text size={"1"}>The cooler is full.</Text>
        </Flex>
      );
    }
    return (
      <Flex className="fade-in" direction="column" gap="4" p="4">
        <ChargeButton
          onRelease={handleCastRelease}
          maxHoldMs={CAST_CHARGE_DURATION}
          minWidth={200}
        >
          cast
        </ChargeButton>
      </Flex>
    );
  }

  if (gameState === GameState.CastAnimation) {
    return <ReelView distance={castProgress} lineHp={lineHpRef.current} />;
  }

  if (gameState === GameState.Luring) {
    return (
      <ReelView
        distance={luringDistance}
        lineHp={lineHpRef.current}
        onReelStart={() => {
          isReelingRef.current = true;
        }}
        onReelEnd={() => {
          isReelingRef.current = false;
        }}
      />
    );
  }

  if (gameState === GameState.Fighting && fightState !== null) {
    return (
      <ReelView
        distance={fightState.distance}
        fightState={fightState}
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

  return (
    <Flex direction="column" gap="4" p="4" justify="start">
      <MyButton onClick={() => setGameState(GameState.Idle)}>go back</MyButton>
    </Flex>
  );
}
