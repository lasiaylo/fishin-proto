import React, { useCallback, useEffect, useState } from "react";

import { Graphics, useTick } from "@pixi/react";
import { Graphics as PixiGraphics } from "@pixi/graphics";
import { easeInOutSine } from "../../util/Ease";
import { addResourceAmount, RT } from "../../stores/resourceStore";
import { clamp } from "../../util/util";
import { MS_IN_SEC } from "../../util/constants";
import { BAKERY, BLACK, HORIZON, HOUSE, initStyle } from "./Canvas";
import { addSpeed, useDelivererStat } from "../../stores/delivererStore";
import { useUpgrade } from "../../stores/upgradeStore";

enum JState {
  Loading,
  Delivering,
  Unloading,
  Returning,
}

const DELIVERER_SIZE = 8;
const BREAD_SIZE = DELIVERER_SIZE / 2;
const DELTA = 10;

const DECAY_SPEED = 1;

export function Deliverer() {
  const [distancePercent, setDistancePercent] = useState(0);
  const [state, setState] = useState(JState.Loading);
  const [carryCount, setCarryCount] = useState(0);
  const { travelTime, loadSpeed, population } = useDelivererStat();
  const { amount } = useUpgrade((s) => s.Town);

  const load = useCallback(() => {
    setCarryCount((count) => {
      let delta = state === JState.Loading ? 1 : -1;
      let newCount = clamp(count + delta, 0, population);
      if (state === JState.Loading && newCount >= population) {
        setState(JState.Delivering);
      }
      if (state === JState.Unloading) {
        const addAmount = Math.max(
          1,
          Math.floor(amount * DELTA - 5 + Math.random() * 10),
        );
        addResourceAmount(RT.Money, addAmount);
        if (newCount <= 0) {
          setState(JState.Returning);
        }
      }
      return newCount;
    });
  }, [state, population]);

  const travel = useCallback(
    (delta: number) => {
      const travelRate = ((1 / travelTime) * delta) / MS_IN_SEC;
      const mult = state === JState.Delivering ? 1 : -1;
      setDistancePercent((i) => {
        const newI = i + travelRate * mult;
        if (state === JState.Delivering && newI >= 1) {
          setState(JState.Unloading);
        }
        if (state === JState.Returning && newI <= 0) {
          setState(JState.Loading);
        }
        return newI;
      });
    },
    [state, travelTime],
  );

  useEffect(() => {
    if (!(state === JState.Loading || state === JState.Unloading)) {
      return;
    }
    const interval = setInterval(load, loadSpeed * MS_IN_SEC);
    return () => clearInterval(interval);
  }, [state]);

  useTick((_delta, ticker) => {
    addSpeed((-ticker.deltaMS / MS_IN_SEC) * DECAY_SPEED);
    switch (state) {
      case JState.Delivering:
      case JState.Returning:
        travel(ticker.deltaMS);
        break;
    }
  });

  const gap = 40;
  const x =
    easeInOutSine(distancePercent) * (HOUSE - BAKERY - gap * 2) +
    BAKERY +
    gap +
    15;
  const draw = useCallback(
    (g: PixiGraphics) => {
      g.clear();
      initStyle(g);
      g.drawRect(x, HORIZON - DELIVERER_SIZE, DELIVERER_SIZE, DELIVERER_SIZE);

      Array(Math.floor(carryCount))
        .fill(null)
        .map((_, i) => {
          g.beginFill(BLACK);
          g.drawRoundedRect(
            x + BREAD_SIZE / 2,
            HORIZON - (DELIVERER_SIZE + (BREAD_SIZE + 2) * (i + 1)),
            BREAD_SIZE,
            BREAD_SIZE,
            0.8,
          );
          g.endFill();
        });
    },
    [x, carryCount],
  );

  return <Graphics draw={draw} />;
}
