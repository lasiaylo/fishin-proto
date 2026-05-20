import React, { useCallback, useRef, useState } from "react";
import { Container, Graphics, Stage, Text, useTick } from "@pixi/react";
import { Graphics as PixiGraphics } from "@pixi/graphics";
import { TextStyle } from "@pixi/text";
import { FightEngine, FightState } from "../game/FightEngine";

// ── Canvas dimensions ──

const WIDTH = 500;
const HEIGHT = 300;

// ── Layout ──

const WATER_Y = 60;
const FISH_Y = 180;
const ROD_X = 30;
const ROD_Y = 20;
const FISH_MIN_X = 60;
const FISH_MAX_X = WIDTH - 40;

// ── Colors ──

const BG_COLOR = 0x000000;

// ── Helpers ──

function tensionColor(tension: number, lineHp: number): number {
  const t = Math.min(1, Math.max(0, tension / lineHp));
  // white → yellow → red
  if (t < 0.5) {
    const p = t / 0.5;
    const r = 255;
    const g = 255;
    const b = Math.round(255 * (1 - p));
    return (r << 16) | (g << 8) | b;
  }
  const p = (t - 0.5) / 0.5;
  const r = 255;
  const g = Math.round(255 * (1 - p));
  const b = 0;
  return (r << 16) | (g << 8) | b;
}

function fishX(distance: number): number {
  const t = distance / 100;
  return FISH_MIN_X + t * (FISH_MAX_X - FISH_MIN_X);
}

// ── Text styles ──

const resultStyle = new TextStyle({
  fontFamily: "monospace",
  fontSize: 24,
  fill: 0xffffff,
  fontWeight: "bold",
  align: "center",
});

// ── Props ──

export interface FightCanvasProps {
  fishSpeed: number;
  fishStrength: number;
  reelStr: number;
  drag: number;
  lineHp: number;
  isReeling: boolean;
  onEnd: (outcome: "WIN" | "LOSE") => void;
}

// ── Scene (child of Stage, can use useTick) ──

function FightScene({
  fishSpeed,
  fishStrength,
  reelStr,
  drag,
  lineHp,
  isReeling,
  onEnd,
}: FightCanvasProps) {
  const engineRef = useRef(
    new FightEngine(fishSpeed, fishStrength, reelStr, drag, lineHp),
  );
  const [state, setState] = useState<FightState>(engineRef.current.getState());
  const endedRef = useRef(false);
  const prevDistRef = useRef(state.distance);
  const fishDirRef = useRef(1); // 1 = moving right (away), -1 = moving left (toward player)

  useTick((_delta, ticker) => {
    if (endedRef.current) return;
    const dt = ticker.deltaMS / 1000;
    const next = engineRef.current.tick(dt, isReeling);
    if (next.distance !== prevDistRef.current) {
      fishDirRef.current = next.distance > prevDistRef.current ? 1 : -1;
    }
    prevDistRef.current = next.distance;
    setState(next);

    if (next.outcome !== null && !endedRef.current) {
      endedRef.current = true;
      setTimeout(() => onEnd(next.outcome!), 1200);
    }
  });

  const fx = fishX(state.distance);
  const lineColor = tensionColor(state.tension, lineHp);
  // Fish faces left by default (head at -x, tail at +x).
  // Moving right (away) → scaleX = -1 (flip). Moving left (toward player) → scaleX = 1.
  const fishScaleX = fishDirRef.current === 1 ? -1 : 1;

  const drawWater = useCallback(
    (g: PixiGraphics) => {
      g.clear();
      // wave line
      g.lineStyle(1, 0xffffff, 0.4);
      g.moveTo(0, WATER_Y);
      for (let x = 0; x <= WIDTH; x += 20) {
        g.lineTo(x, WATER_Y + Math.sin(x * 0.05 + state.time * 2) * 4);
      }
    },
    [state.time],
  );

  const drawLine = useCallback(
    (g: PixiGraphics) => {
      g.clear();
      g.lineStyle(1, lineColor, 1);
      g.moveTo(ROD_X, ROD_Y);
      g.lineTo(fx - 18 * fishScaleX, FISH_Y);
    },
    [lineColor, fx, fishScaleX],
  );

  const drawFish = useCallback((g: PixiGraphics) => {
    g.clear();
    g.lineStyle(1, 0xffffff);
    // body (drawn at origin)
    g.drawEllipse(0, 0, 18, 10);
    // tail
    g.moveTo(18, 0);
    g.lineTo(28, -8);
    g.lineTo(28, 8);
    g.closePath();
  }, []);

  const outcomeText =
    state.outcome === "WIN"
      ? "Caught it!"
      : state.outcome === "LOSE"
        ? "The fish got away..."
        : null;

  return (
    <Container>
      <Graphics draw={drawWater} />
      <Graphics draw={drawLine} />
      <Graphics
        draw={drawFish}
        x={fx}
        y={FISH_Y}
        scale={{ x: fishScaleX, y: 1 }}
      />
      {outcomeText !== null && (
        <Text
          text={outcomeText}
          style={resultStyle}
          anchor={0.5}
          x={WIDTH / 2}
          y={HEIGHT - 40}
        />
      )}
    </Container>
  );
}

export function FightCanvas(props: FightCanvasProps) {
  return (
    <div style={{ userSelect: "none", width: "fit-content" }}>
      <Stage
        width={WIDTH}
        height={HEIGHT}
        options={{ backgroundColor: BG_COLOR }}
      >
        <FightScene {...props} />
      </Stage>
    </div>
  );
}
