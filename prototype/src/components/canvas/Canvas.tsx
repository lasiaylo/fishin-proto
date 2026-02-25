import React from "react";

import { Graphics, Stage } from "@pixi/react";
import { Graphics as PixiGraphics } from "@pixi/graphics";
import { Deliverer } from "./Deliverer";
import { WorkerT } from "../../stores/workerStore";
import { useUpgrade } from "../../stores/upgradeStore";
import { useShallow } from "zustand/react/shallow";
import { WORKER_BUYABLES } from "../WorkerView";

export const WIDTH = 600;
export const HEIGHT = 200;
export const HORIZON = HEIGHT - 50;

export const WHITE = "WHITE";
export const BLACK = "black";

const WORKER_MAP = {
  [WorkerT.Baker]: Baker,
  [WorkerT.Deliverer]: Deliverer,
};

export function Canvas() {
  return (
    <Stage
      width={WIDTH}
      height={HEIGHT}
      options={{ backgroundColor: 0xffffff }}
    >
      <Bakery />
      <House />
      {getWorkers()}
      <Horizon />
    </Stage>
  );
}

function getWorkers() {
  return <Deliverer />;
  const workers = useUpgrade(
    useShallow((s) =>
      Object.fromEntries(
        WORKER_BUYABLES.filter((key) => key in s).map((key) => [
          key,
          s[key].amount,
        ]),
      ),
    ),
  );
  return (
    <>
      {Object.entries(workers).map(([worker, amount]) => {
        return Array(amount)
          .fill(null)
          .map((_, i) => {
            const Component =
              WORKER_MAP[WorkerT[worker as keyof typeof WorkerT]];
            return <Component key={`${worker}-${i}`} />;
          });
      })}
    </>
  );
}

function Horizon() {
  return (
    <Graphics
      draw={(g) => {
        g.lineStyle(1, BLACK, 1);
        g.moveTo(0, HORIZON);
        g.lineTo(WIDTH, HORIZON);
      }}
    />
  );
}

export const BAKERY = WIDTH / 8;
export const BAKERY_DOOR = BAKERY + 10;

function Bakery() {
  const size = 30;
  return (
    <Graphics
      draw={(g) => {
        g.clear();
        initStyle(g);
        g.drawRect(BAKERY, HORIZON - size, size * 1.55, size);
        g.drawRect(BAKERY_DOOR, HORIZON - 20, 13, 20);
        g.drawRect(BAKERY + 30, HORIZON - 18, 10, 10);
      }}
    />
  );
}

export const HOUSE = WIDTH - WIDTH / 4;
export const HOUSE_DOOR = HOUSE + 10;

function House() {
  const size = 30;
  return (
    <Graphics
      draw={(g) => {
        g.clear();
        initStyle(g);
        g.drawRect(HOUSE, HORIZON - size, size * 1.55, size);
        g.drawRect(HOUSE_DOOR, HORIZON - 20, 13, 20);
        g.drawRect(HOUSE + 30, HORIZON - 18, 10, 10);
      }}
    />
  );
}

export function initStyle(g: PixiGraphics) {
  g.lineStyle(1, BLACK, 1);
  g.beginFill(WHITE);
}

function Baker() {
  return <></>;
}

export default Canvas;
