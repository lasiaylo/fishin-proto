import React, { CSSProperties, useEffect, useRef, useState } from "react";
import { Box } from "@radix-ui/themes";
import {
  collectParticle,
  depositParticle,
  useFields,
} from "../stores/fieldsStore";
import { CURRENCY_TARGET_ID } from "./CurrencyView";
import {
  FIELDS_PARTICLE_FADE_MS,
  FIELDS_PARTICLE_LIFETIME_MS,
} from "../util/constants";

const FLIGHT_MS = 1500;
// Max sideways bulge of the flight path, as a fraction of its length. Each
// flight picks its own bulge in [-max, max] so they don't trace one path.
const FLIGHT_ARC_MAX = 0.5;
// Point in the flight (0–1) at which the particle starts fading out.
const FLIGHT_FADE_START = 0.7;

interface Flyer {
  id: number;
  startX: number;
  startY: number;
  arc: number;
}

export function GrassView() {
  const particles = useFields((s) => s.particles);
  const [flyers, setFlyers] = useState<Flyer[]>([]);

  function collect(id: number, e: React.MouseEvent<HTMLDivElement>) {
    // Start the flight where the dot is drawn right now (mid-bob/drift).
    const dot = e.currentTarget.firstElementChild ?? e.currentTarget;
    const rect = dot.getBoundingClientRect();
    if (!collectParticle(id)) return;
    setFlyers((f) => [
      ...f,
      {
        id,
        startX: rect.left + rect.width / 2,
        startY: rect.top + rect.height / 2,
        arc: (Math.random() * 2 - 1) * FLIGHT_ARC_MAX,
      },
    ]);
  }

  return (
    <Box position="relative">
      <img
        src="/grass.png"
        alt=""
        width={147}
        style={{ display: "block", height: "auto" }}
      />
      {particles.map((p) => (
        <div
          key={p.id}
          className="grass-particle"
          onMouseEnter={(e) => collect(p.id, e)}
          style={
            {
              "--ox": `${p.originX}px`,
              "--oy": `${p.originY}px`,
              "--x": `${p.x}px`,
              "--y": `${p.y}px`,
              "--fade-ms": `${FIELDS_PARTICLE_FADE_MS}ms`,
              "--fade-delay": `${FIELDS_PARTICLE_LIFETIME_MS - FIELDS_PARTICLE_FADE_MS}ms`,
            } as CSSProperties
          }
        >
          <div className="grass-particle-dot" />
        </div>
      ))}
      {flyers.map((f) => (
        <FlyingParticle
          key={f.id}
          startX={f.startX}
          startY={f.startY}
          arc={f.arc}
          onLand={() => {
            depositParticle();
            setFlyers((all) => all.filter((other) => other.id !== f.id));
          }}
        />
      ))}
    </Box>
  );
}

function FlyingParticle({
  startX,
  startY,
  arc,
  onLand,
}: {
  startX: number;
  startY: number;
  arc: number;
  onLand: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const onLandRef = useRef(onLand);
  onLandRef.current = onLand;

  useEffect(() => {
    const startedAt = performance.now();
    let raf = 0;
    function tick(now: number) {
      // Re-read the target each frame in case the layout shifts mid-flight.
      const target = document
        .getElementById(CURRENCY_TARGET_ID)
        ?.getBoundingClientRect();
      const endX = target ? target.left + target.width / 2 : startX;
      const endY = target ? target.top + target.height / 2 : startY;

      const t = Math.min(1, (now - startedAt) / FLIGHT_MS);
      const eased = t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;

      // Quadratic curve through a control point offset perpendicular to the
      // straight line, so the particle swoops rather than beelines.
      const dx = endX - startX;
      const dy = endY - startY;
      const ctrlX = (startX + endX) / 2 - dy * arc;
      const ctrlY = (startY + endY) / 2 + dx * arc;
      const u = 1 - eased;
      const x = u * u * startX + 2 * u * eased * ctrlX + eased * eased * endX;
      const y = u * u * startY + 2 * u * eased * ctrlY + eased * eased * endY;

      const opacity =
        t < FLIGHT_FADE_START
          ? 1
          : 1 - (t - FLIGHT_FADE_START) / (1 - FLIGHT_FADE_START);

      if (ref.current) {
        ref.current.style.transform = `translate(${x}px, ${y}px)`;
        ref.current.style.opacity = String(opacity);
      }
      if (t < 1) raf = requestAnimationFrame(tick);
      else onLandRef.current();
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [startX, startY, arc]);

  return (
    <div
      ref={ref}
      className="grass-particle-dot grass-particle-flyer"
      // Place it before the first frame so it doesn't flash at the origin.
      style={{ transform: `translate(${startX}px, ${startY}px)` }}
    />
  );
}
