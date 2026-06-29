import React, { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { Flex, Text } from "@radix-ui/themes";
import { ChargeButton } from "./ChargeButton";
import { FishData } from "../util/csvLoader";
import { getBiteChance, getWaitZones, getZones } from "../util/zones";
import { randomizeFishStats, useFish } from "../stores/fishStore";
import { pickFishForZone, useLocation } from "../stores/locationStore";
import { addFishToInventory, usePlayer } from "../stores/playerStore";
import { pushEvent } from "../stores/eventLogStore";
import { EventMsg } from "../util/eventMessages";
import { FightEngine, FightState, Outcome } from "../game/FightEngine";
import { useSessionLog } from "../stores/sessionLogStore";
import { addLureXp, useLureXp } from "../stores/lureXpStore";
import {
  BASE_LURE_ID,
  BITE_CHECK_INTERVAL,
  CAST_CHARGE_DURATION,
  CAST_DURATION_MAX,
  CAST_DURATION_MIN,
  CAST_MIN,
  getLureType,
  LureType,
  lureReelMaxSpeed,
  LURING_REEL_ACCEL,
  LURING_REEL_DECEL,
  Rarity,
  RARITY_COLOR,
  REEL_MIN,
  RESULT_DURATION,
  WAIT_DEFAULT_MAX,
  WAIT_DEFAULT_MIN,
  WAIT_PRIME_MAX,
  WAIT_PRIME_MIN,
  XP_LOSS,
  XP_PER_DISTANCE,
  XP_WIN,
} from "../util/constants";

import { ReelView } from "./ReelView";

enum GameState {
  Idle = "idle",
  CastAnimation = "cast_animation",
  Luring = "luring",
  Waiting = "waiting",
  Fighting = "fighting",
}

export function PondView() {
  const locations = useLocation();
  const invCount = usePlayer((s) => s.inventory.length);
  const inventorySize = usePlayer((s) => s.inventorySize);
  const castMax = usePlayer((s) => s.castMax);

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
  const castDistanceRef = useRef(0);
  const waitCountdownRef = useRef<number | null>(null);
  const hookXpRef = useRef(0);

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
          luringDistanceRef.current = fish.hp / 2;
          caughtFishRef.current = randomizeFishStats(fish);
          startFight();
        }
      }

      function addFish(rarity: Rarity) {
        const fish = useFish.getState().allFish[0];
        fish.rarity = rarity;
        const effectivePrice = Math.round(fish.basePrice);
        addFishToInventory(fish, effectivePrice);
      }
      if (e.key === "0") {
        addFish(Rarity.COMMON);
      }
      if (e.key === "-") {
        addFish(Rarity.UNCOMMON);
      }
      if (e.key === "=") {
        addFish(Rarity.RARE);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  function checkBite(distance: number, lureLevel = 0): boolean {
    const zones = getZones(distance);
    if (zones.length === 0) return false;
    if (
      Math.random() > getBiteChance(zones, emptyReelCountRef.current, lureLevel)
    )
      return false;
    const fish = pickFishForZone(castLocationRef.current, zones);
    if (!fish) return false;
    emptyReelCountRef.current = 0;
    caughtFishRef.current = fish;
    pushEvent(EventMsg.BITING);
    startFight();
    return true;
  }

  function startCastLoop(initialDistance: number) {
    luringDistanceRef.current = initialDistance;
    castDistanceRef.current = initialDistance;
    lastBiteCheckDistanceRef.current = initialDistance;
    luringLastTimeRef.current = null;
    luringReelSpeedRef.current = 0;
    isReelingRef.current = false;
    waitCountdownRef.current = null;

    const { selectedLure } = usePlayer.getState();
    const lureLevel = selectedLure
      ? (useLureXp.getState().lures[selectedLure]?.level ?? 0)
      : 0;
    const effectiveReelMaxSpeed = lureReelMaxSpeed(lureLevel);
    const newGameState =
      getLureType(selectedLure ?? BASE_LURE_ID) === LureType.CAST_AND_WAIT
        ? GameState.Waiting
        : GameState.Luring;

    setGameState(newGameState);
    setLuringDistance(initialDistance);

    function loop(timestamp: number) {
      if (luringLastTimeRef.current === null)
        luringLastTimeRef.current = timestamp;
      const dt = Math.min((timestamp - luringLastTimeRef.current) / 1000, 0.1);
      luringLastTimeRef.current = timestamp;

      if (isReelingRef.current) {
        luringReelSpeedRef.current = Math.min(
          luringReelSpeedRef.current + LURING_REEL_ACCEL * dt,
          effectiveReelMaxSpeed,
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

        if (newGameState === GameState.Luring) {
          if (
            lastBiteCheckDistanceRef.current - luringDistanceRef.current >=
              BITE_CHECK_INTERVAL &&
            initialDistance - luringDistanceRef.current >= REEL_MIN
          ) {
            lastBiteCheckDistanceRef.current = luringDistanceRef.current;
            if (checkBite(luringDistanceRef.current, lureLevel)) return;
          }
        } else {
          waitCountdownRef.current = null;
        }
      } else if (newGameState === GameState.Waiting) {
        if (waitCountdownRef.current === null) {
          const inPrimeZone = getWaitZones(luringDistanceRef.current).length > 0;
          const [min, max] = inPrimeZone
            ? [WAIT_PRIME_MIN, WAIT_PRIME_MAX]
            : [WAIT_DEFAULT_MIN, WAIT_DEFAULT_MAX];
          waitCountdownRef.current = min + Math.random() * (max - min);
        }
        waitCountdownRef.current -= dt;
        if (waitCountdownRef.current <= 0) {
          const waitZones = getWaitZones(luringDistanceRef.current);
          const fish = pickFishForZone(castLocationRef.current, waitZones);
          if (fish) {
            caughtFishRef.current = fish;
            pushEvent(EventMsg.BITING);
            startFight();
            return;
          }
          waitCountdownRef.current = null;
        }
      }

      luringRafRef.current = requestAnimationFrame(loop);
    }

    luringRafRef.current = requestAnimationFrame(loop);
  }

  function startFight() {
    cancelAnimationFrame(luringRafRef.current);
    hookXpRef.current =
      (castDistanceRef.current - luringDistanceRef.current) * XP_PER_DISTANCE;
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
          `${caughtFishRef.current?.name}`,
          `${caughtFishRef.current?.rarity}`,
          `Atk ${caughtFishRef.current?.attack.toFixed(2)}`,
          `Def ${caughtFishRef.current?.defense.toFixed(2)}`,
          `Time ${+state.time.toFixed(2)}`,
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
    const effectivePrice = Math.round(fish.basePrice);

    useSessionLog
      .getState()
      .logFishResult(
        fish,
        result === Outcome.WIN,
        finalState.time,
        finalState.tension,
        lineHP,
        selectedLure ?? "",
        effectivePrice,
      );

    if (selectedLure) {
      addLureXp(selectedLure, result === Outcome.WIN ? XP_WIN : XP_LOSS);
    }

    if (result === Outcome.WIN) {
      addFishToInventory(fish, effectivePrice);
      const msg = EventMsg.CAUGHT(fish.name);
      pushEvent(
        msg[0],
        msg[1],
        fish.rarity ? RARITY_COLOR[fish.rarity] : undefined,
      );
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

    castProgressObjRef.current.value = 0;
    setCastProgress(0);
    setGameState(GameState.CastAnimation);

    castTweenRef.current = gsap.to(castProgressObjRef.current, {
      value: castTarget,
      duration: CAST_DURATION_MIN + t * (CAST_DURATION_MAX - CAST_DURATION_MIN),
      ease: "power3.out",
      onUpdate: () => setCastProgress(castProgressObjRef.current.value),
      onComplete: () => {
        startCastLoop(castTarget);
      },
    });
  }

  function handleReelIn() {
    cancelAnimationFrame(luringRafRef.current);
    emptyReelCountRef.current += 1;
    const { selectedLure } = usePlayer.getState();
    if (selectedLure) {
      addLureXp(selectedLure, castDistanceRef.current * XP_PER_DISTANCE);
    }
    setGameState(GameState.Idle);
  }

  let component;

  if (gameState === GameState.Idle) {
    component =
      invCount >= inventorySize ? (
        <Text size={"1"}>the cooler is full</Text>
      ) : (
        <ChargeButton
          onRelease={handleCastRelease}
          maxHoldMs={CAST_CHARGE_DURATION}
          width={200}
        >
          cast
        </ChargeButton>
      );
  } else if (gameState === GameState.CastAnimation) {
    component = <ReelView distance={castProgress} lineHp={lineHpRef.current} />;
  } else if (
    gameState === GameState.Luring ||
    gameState === GameState.Waiting
  ) {
    component = (
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
  } else if (gameState === GameState.Fighting && fightState !== null) {
    component = (
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
    <Flex className="fade-in" width="100%" direction="column" gap="3" p="4">
      {component}
    </Flex>
  );
}
