import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Container, Graphics, Stage, useTick } from "@pixi/react";
import { Graphics as PixiGraphics } from "@pixi/graphics";

// ── Canvas dimensions (match FightCanvas) ──

const WIDTH = 500;
const HEIGHT = 300;

// ── Layout ──

const WATER_Y = 60;
const FISH_Y = 180;
const HOOK_X = 250;
const ROD_X = 30;
const ROD_Y = 20;
const FISH_MIN_X = 60;
const FISH_MAX_X = WIDTH - 40;

// ── Colors ──

const BG_COLOR = 0x000000;

// ── Fish behavior constants ──

const SWIM_SPEED = 80;
const APPROACH_SPEED = 120;
const RETREAT_SPEED = 150;
const SWIM_DURATION: [number, number] = [3, 6];
const NIBBLE_DURATION = 0.5;
const BITE_DURATION = 2.0;
const NIBBLE_CHANCE = 0.6;

// ── Lure state machine ──

type LurePhase =
  | "SWIMMING"
  | "APPROACHING"
  | "NIBBLING"
  | "BITING"
  | "RETREATING";

interface LureState {
  phase: LurePhase;
  fishX: number;
  fishDir: number;
  phaseTime: number;
  phaseDuration: number;
  time: number;
}

function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function initLureState(): LureState {
  return {
    phase: "SWIMMING",
    fishX: FISH_MAX_X,
    fishDir: -1,
    phaseTime: 0,
    phaseDuration: randomRange(SWIM_DURATION[0], SWIM_DURATION[1]),
    time: 0,
  };
}

// ── Props & Handle ──

export interface LureCanvasProps {
  onBiteChange: (isBiting: boolean) => void;
}

export interface LureCanvasHandle {
  hookAttempt: () => "bite" | "nibble" | "miss";
}

// ── Scene (child of Stage, can use useTick) ──

const LureScene = forwardRef<
  LureCanvasHandle,
  { onBiteChange: (isBiting: boolean) => void }
>(function LureScene({ onBiteChange }, ref) {
  const stateRef = useRef<LureState>(initLureState());
  const [renderState, setRenderState] = useState<LureState>(stateRef.current);
  const bitingRef = useRef(false);

  useImperativeHandle(ref, () => ({
    hookAttempt(): "bite" | "nibble" | "miss" {
      const s = stateRef.current;
      if (s.phase === "BITING") {
        // Success — will be transitioned to fighting by PondView
        return "bite";
      }
      if (s.phase === "NIBBLING") {
        // Fakeout — retreat
        s.phase = "RETREATING";
        s.phaseTime = 0;
        s.phaseDuration = 0;
        return "nibble";
      }
      return "miss";
    },
  }));

  useTick((_delta, ticker) => {
    const dt = ticker.deltaMS / 1000;
    const s = stateRef.current;
    s.phaseTime += dt;
    s.time += dt;

    switch (s.phase) {
      case "SWIMMING": {
        s.fishX += s.fishDir * SWIM_SPEED * dt;
        if (s.fishX <= FISH_MIN_X) {
          s.fishX = FISH_MIN_X;
          s.fishDir = 1;
        } else if (s.fishX >= FISH_MAX_X) {
          s.fishX = FISH_MAX_X;
          s.fishDir = -1;
        }
        if (s.phaseTime >= s.phaseDuration) {
          s.phase = "APPROACHING";
          s.phaseTime = 0;
          s.phaseDuration = 0;
        }
        break;
      }
      case "APPROACHING": {
        const dir = HOOK_X > s.fishX ? 1 : -1;
        s.fishX += dir * APPROACH_SPEED * dt;
        // Close enough to hook
        if (Math.abs(s.fishX - HOOK_X) < 5) {
          s.fishX = HOOK_X;
          s.phaseTime = 0;
          if (Math.random() < NIBBLE_CHANCE) {
            s.phase = "NIBBLING";
            s.phaseDuration = NIBBLE_DURATION;
          } else {
            s.phase = "BITING";
            s.phaseDuration = BITE_DURATION;
            if (!bitingRef.current) {
              bitingRef.current = true;
              onBiteChange(true);
            }
          }
        }
        break;
      }
      case "NIBBLING": {
        // Fish wiggles at hook position
        s.fishX = HOOK_X + Math.sin(s.phaseTime * 20) * 4;
        if (s.phaseTime >= s.phaseDuration) {
          s.phase = "RETREATING";
          s.phaseTime = 0;
          s.phaseDuration = 0;
        }
        break;
      }
      case "BITING": {
        s.fishX = HOOK_X;
        if (s.phaseTime >= s.phaseDuration) {
          // Missed the bite
          s.phase = "RETREATING";
          s.phaseTime = 0;
          s.phaseDuration = 0;
          if (bitingRef.current) {
            bitingRef.current = false;
            onBiteChange(false);
          }
        }
        break;
      }
      case "RETREATING": {
        if (bitingRef.current) {
          bitingRef.current = false;
          onBiteChange(false);
        }
        // Swim away from hook
        const retreatDir = s.fishX < HOOK_X ? -1 : 1;
        s.fishX += retreatDir * RETREAT_SPEED * dt;
        const atEdge =
          s.fishX <= FISH_MIN_X || s.fishX >= FISH_MAX_X;
        const farEnough = Math.abs(s.fishX - HOOK_X) > 80;
        if (atEdge || farEnough) {
          s.fishX = Math.max(FISH_MIN_X, Math.min(FISH_MAX_X, s.fishX));
          s.fishDir = s.fishX >= FISH_MAX_X ? -1 : 1;
          s.phase = "SWIMMING";
          s.phaseTime = 0;
          s.phaseDuration = randomRange(SWIM_DURATION[0], SWIM_DURATION[1]);
        }
        break;
      }
    }

    setRenderState({ ...s });
  });

  const { fishX, fishDir, time, phase } = renderState;

  // Fish faces left by default (head at -x, tail at +x).
  // scaleX = -1 flips it to face right.
  let visualDir = fishDir;
  if (phase === "APPROACHING") {
    visualDir = HOOK_X > fishX ? 1 : -1;
  } else if (phase === "RETREATING") {
    visualDir = fishX < HOOK_X ? -1 : 1;
  }
  const fishScaleX = visualDir === 1 ? -1 : 1;

  const drawWater = useCallback(
    (g: PixiGraphics) => {
      g.clear();
      g.lineStyle(1, 0xffffff, 0.4);
      g.moveTo(0, WATER_Y);
      for (let x = 0; x <= WIDTH; x += 20) {
        g.lineTo(x, WATER_Y + Math.sin(x * 0.05 + time * 2) * 4);
      }
    },
    [time],
  );

  const drawHookLine = useCallback((g: PixiGraphics) => {
    g.clear();
    // Line from rod to hook
    g.lineStyle(1, 0xffffff, 0.6);
    g.moveTo(ROD_X, ROD_Y);
    g.lineTo(HOOK_X, FISH_Y - 12);
    // Hook "V" shape
    g.lineStyle(1, 0xffffff);
    g.moveTo(HOOK_X - 4, FISH_Y - 12);
    g.lineTo(HOOK_X, FISH_Y);
    g.lineTo(HOOK_X + 4, FISH_Y - 12);
  }, []);

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

  return (
    <Container>
      <Graphics draw={drawWater} />
      <Graphics draw={drawHookLine} />
      <Graphics
        draw={drawFish}
        x={fishX}
        y={FISH_Y}
        scale={{ x: fishScaleX, y: 1 }}
      />
    </Container>
  );
});

// ── Main component ──

export const LureCanvas = forwardRef<LureCanvasHandle, LureCanvasProps>(
  function LureCanvas({ onBiteChange }, ref) {
    const sceneRef = useRef<LureCanvasHandle>(null);

    useImperativeHandle(ref, () => ({
      hookAttempt() {
        return sceneRef.current?.hookAttempt() ?? "miss";
      },
    }));

    return (
      <div style={{ userSelect: "none", width: "fit-content" }}>
        <Stage
          width={WIDTH}
          height={HEIGHT}
          options={{ backgroundColor: BG_COLOR }}
        >
          <LureScene ref={sceneRef} onBiteChange={onBiteChange} />
        </Stage>
      </div>
    );
  },
);
