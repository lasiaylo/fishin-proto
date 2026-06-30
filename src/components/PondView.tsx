import React, { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { Flex, Progress, Select, Text } from "@radix-ui/themes";
import { useShallow } from "zustand/react/shallow";
import { ChargeButton } from "./ChargeButton";
import { FishData, StatName } from "../util/csvLoader";
import { getBiteChance, getWaitZones, getZones } from "../util/zones";
import { randomizeFishStats, useFish } from "../stores/fishStore";
import { pickFishForZone, useLocation } from "../stores/locationStore";
import {
  addFishToInventory,
  assignRodToSlot,
  consumeBait,
  setSlotItem,
  usePlayer,
} from "../stores/playerStore";
import { pushEvent } from "../stores/eventLogStore";
import { EventMsg } from "../util/eventMessages";
import { FightEngine, FightState, Outcome } from "../game/FightEngine";
import { useSessionLog } from "../stores/sessionLogStore";
import { addLureXp, lureXpProgress, useLureXp } from "../stores/lureXpStore";
import { useShop } from "../stores/shopStore";
import { useBaitData } from "../stores/baitStore";
import {
  BAIT_ID_PREFIX,
  BASE_BAIT_ID,
  BITE_CHECK_INTERVAL,
  CAST_CHARGE_DURATION,
  CAST_DURATION_MAX,
  CAST_DURATION_MIN,
  CAST_MIN,
  getTackleType,
  lureReelMaxSpeed,
  LURING_REEL_ACCEL,
  LURING_REEL_DECEL,
  Rarity,
  RARITY_COLOR,
  REEL_MIN,
  RESULT_DURATION,
  TackleType,
  WAIT_DEFAULT_MAX,
  WAIT_DEFAULT_MIN,
  WAIT_PRIME_REDUCTION,
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

function RodRow({ slotIndex }: { slotIndex: number }) {
  const {
    ownedRods,
    rodSlotAssignments,
    rodSlotItems,
    baitInventory,
    ownedLures,
    invCount,
    inventorySize,
    castMax,
  } = usePlayer(
    useShallow((s) => ({
      ownedRods: s.ownedRods,
      rodSlotAssignments: s.rodSlotAssignments,
      rodSlotItems: s.rodSlotItems,
      baitInventory: s.baitInventory,
      ownedLures: s.ownedLures,
      invCount: s.inventory.length,
      inventorySize: s.inventorySize,
      castMax: s.castMax,
    })),
  );
  const shopUpgrades = useShop((s) => s.upgrades);
  const lureXpData = useLureXp((s) => s.lures);
  const locations = useLocation();
  const baitData = useBaitData((s) => s.baitData);

  const assignment = rodSlotAssignments[slotIndex] ?? null;
  const selectedItem = rodSlotItems[slotIndex] ?? BASE_BAIT_ID;
  const isWaitType =
    getTackleType(selectedItem) === TackleType.BAIT &&
    selectedItem.startsWith(BAIT_ID_PREFIX);

  const luresUsedElsewhere = new Set(
    rodSlotItems.filter(
      (item, i) => i !== slotIndex && item !== null && getTackleType(item) === TackleType.LURE,
    ),
  );
  const ownedLureList = shopUpgrades.filter(
    (u) => u.stat === StatName.LURE && ownedLures.has(u.id) && !luresUsedElsewhere.has(u.id),
  );

  const [gameState, setGameState] = useState<GameState>(GameState.Idle);
  const [fading, setFading] = useState(false);
  const [fightState, setFightState] = useState<FightState | null>(null);
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
      if (slotIndex !== 0) return;
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
      if (e.key === "0") addFish(Rarity.COMMON);
      if (e.key === "-") addFish(Rarity.UNCOMMON);
      if (e.key === "=") addFish(Rarity.RARE);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  function checkBite(
    distance: number,
    lureId: string,
    lureLevel: number,
  ): boolean {
    const zones = getZones(distance);
    if (zones.length === 0) return false;
    if (
      Math.random() > getBiteChance(zones, emptyReelCountRef.current, lureLevel)
    )
      return false;
    const fish = pickFishForZone(castLocationRef.current, zones, lureId);
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

    const { rodSlotItems: items } = usePlayer.getState();
    const item = items[slotIndex] ?? BASE_BAIT_ID;
    const lureType = getTackleType(item);
    const lureLevel = useLureXp.getState().lures[item]?.level ?? 0;
    const effectiveReelMaxSpeed = lureReelMaxSpeed(lureLevel);

    const bait = useBaitData.getState().baitData.find((b) => b.id === item);
    const waitMin = bait?.waitMin ?? WAIT_DEFAULT_MIN;
    const waitMax = bait?.waitMax ?? WAIT_DEFAULT_MAX;

    const newGameState =
      lureType === TackleType.BAIT ? GameState.Waiting : GameState.Luring;

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
            if (checkBite(luringDistanceRef.current, item, lureLevel)) return;
          }
        } else {
          waitCountdownRef.current = null;
        }
      } else if (newGameState === GameState.Waiting) {
        if (waitCountdownRef.current === null) {
          const inPrimeZone =
            getWaitZones(luringDistanceRef.current).length > 0;
          const raw = waitMin + Math.random() * (waitMax - waitMin);
          waitCountdownRef.current = inPrimeZone
            ? raw * (1 - WAIT_PRIME_REDUCTION)
            : raw;
        }
        waitCountdownRef.current -= dt;
        if (waitCountdownRef.current <= 0) {
          const waitZones = getWaitZones(luringDistanceRef.current);
          const fish = pickFishForZone(
            castLocationRef.current,
            waitZones,
            item,
          );
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

    const {
      rodSlotAssignments: assignments,
      ownedRods: rods,
      lineHP,
    } = usePlayer.getState();
    const rodId = assignments[slotIndex];
    const rod = rods.find((r) => r.id === rodId);
    const attack = rod?.attack ?? 0;
    const defense = rod?.defense ?? 0;
    lineHpRef.current = lineHP;

    const fish = caughtFishRef.current!;

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
    const { lineHP, rodSlotItems: items } = usePlayer.getState();
    const item = items[slotIndex] ?? BASE_BAIT_ID;
    const effectivePrice = Math.round(fish.basePrice);

    useSessionLog
      .getState()
      .logFishResult(
        fish,
        result === Outcome.WIN,
        finalState.time,
        finalState.tension,
        lineHP,
        item,
        effectivePrice,
      );

    if (getTackleType(item) === TackleType.LURE) {
      addLureXp(item, result === Outcome.WIN ? XP_WIN : XP_LOSS);
    }

    if (getTackleType(item) === TackleType.BAIT) {
      consumeBait(item);
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
    const locationId = Object.keys(locations)[0];
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
    const { rodSlotItems: items } = usePlayer.getState();
    const item = items[slotIndex] ?? BASE_BAIT_ID;
    if (getTackleType(item) === TackleType.LURE) {
      addLureXp(item, castDistanceRef.current * XP_PER_DISTANCE);
    }
    setGameState(GameState.Idle);
  }

  const baitCount = baitInventory[selectedItem] ?? 0;
  const castDisabled =
    invCount >= inventorySize || (isWaitType && baitCount === 0);

  let controls: React.ReactNode;
  if (gameState === GameState.Idle) {
    if (invCount >= inventorySize) {
      controls = <Text size="1">the cooler is full</Text>;
    } else if (isWaitType && baitCount === 0) {
      controls = <Text size="1">no bait</Text>;
    } else {
      controls = (
        <Flex flexGrow={"1"}>
          <ChargeButton
            onRelease={handleCastRelease}
            maxHoldMs={CAST_CHARGE_DURATION}
            width={150}
            disabled={castDisabled}
          >
            cast
          </ChargeButton>
        </Flex>
      );
    }
  } else if (gameState === GameState.CastAnimation) {
    controls = <ReelView distance={castProgress} lineHp={lineHpRef.current} />;
  } else if (
    gameState === GameState.Luring ||
    gameState === GameState.Waiting
  ) {
    controls = (
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
    controls = (
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

  const lureXpEntry = lureXpData[selectedItem];
  const lureXpVal = lureXpEntry?.xp ?? 0;
  const lureLevel = lureXpEntry?.level ?? 0;
  const lureProgress = lureXpProgress(lureXpVal, lureLevel);

  return (
    <Flex direction="column" gap="2" minHeight={"150px"}>
      <Flex gap="4">
        <Flex flexGrow={"1"}>{controls}</Flex>
        <Flex direction="column" width={"120px"} gap="2">
          <Select.Root
            size="1"
            value={assignment ?? "none"}
            onValueChange={(v) =>
              assignRodToSlot(slotIndex, v === "none" ? null : v)
            }
          >
            <Select.Trigger variant="soft" />
            <Select.Content>
              <Select.Item value="none">None</Select.Item>
              {ownedRods.map((rod) => (
                <Select.Item key={rod.id} value={rod.id}>
                  {rod.id}
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Root>
          {assignment !== null && (
            <>
              <Select.Root
                size="1"
                value={selectedItem}
                onValueChange={(v) => setSlotItem(slotIndex, v)}
              >
                <Select.Trigger variant="soft" />
                <Select.Content>
                  {Object.entries(baitInventory).map(([id, count]) => {
                    const bait = baitData.find((b) => b.id === id);
                    return (
                      <Select.Item key={id} value={id}>
                        {bait?.id ?? id}
                      </Select.Item>
                    );
                  })}
                  {ownedLureList.map((u) => {
                    const lvl = lureXpData[u.id]?.level ?? 0;
                    return (
                      <Select.Item key={u.id} value={u.id}>
                        {u.name}
                      </Select.Item>
                    );
                  })}
                </Select.Content>
              </Select.Root>
              {getTackleType(selectedItem) === TackleType.LURE && (
                <Flex align="center" gap="2">
                  <Text size="1" color="gray">
                    {`lvl ${lureLevel}`}
                  </Text>
                  <Progress
                    radius="none"
                    size="2"
                    value={Math.round(lureProgress * 100)}
                  />
                </Flex>
              )}
            </>
          )}
        </Flex>
      </Flex>
    </Flex>
  );
}

export function PondView() {
  const rodCount = usePlayer((s) => s.rodSlotAssignments.length);

  return (
    <Flex className="fade-in" width="100%" direction="column" gap="4" p="3">
      {Array.from({ length: rodCount }).map((_, i) => (
        <RodRow key={i} slotIndex={i} />
      ))}
    </Flex>
  );
}
