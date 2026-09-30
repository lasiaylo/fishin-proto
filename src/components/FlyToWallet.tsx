import React, { useEffect, useRef } from "react";
import { CURRENCY_TARGET_ID } from "./CurrencyView";

const FLIGHT_MS = 1500;
// Max sideways bulge of the flight path, as a fraction of its length. Each
// flight picks its own bulge in [-max, max] so they don't trace one path.
const FLIGHT_ARC_MAX = 0.5;
// Point in the flight (0–1) at which the flyer starts fading out.
const FLIGHT_FADE_START = 0.7;
// Point in the flight (0–1) by which a flyer grabbed mid-fade-in reaches
// full brightness, so it brightens smoothly instead of popping.
const FLIGHT_BRIGHTEN_END = 0.2;

export function randomFlightArc() {
  return (Math.random() * 2 - 1) * FLIGHT_ARC_MAX;
}

// Flies its children from a viewport point to the currency display, then
// calls onLand. Children are centered on the flight path.
export function FlyToWallet({
  startX,
  startY,
  arc,
  startOpacity = 1,
  onLand,
  children,
}: {
  startX: number;
  startY: number;
  arc: number;
  startOpacity?: number;
  onLand: () => void;
  children: React.ReactNode;
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
      // Ease-out: leaves at speed so a flyer grabbed mid-drift doesn't stall.
      const eased = 1 - (1 - t) ** 3;

      // Quadratic curve through a control point offset perpendicular to the
      // straight line, so the flyer swoops rather than beelines.
      const dx = endX - startX;
      const dy = endY - startY;
      const ctrlX = (startX + endX) / 2 - dy * arc;
      const ctrlY = (startY + endY) / 2 + dx * arc;
      const u = 1 - eased;
      const x = u * u * startX + 2 * u * eased * ctrlX + eased * eased * endX;
      const y = u * u * startY + 2 * u * eased * ctrlY + eased * eased * endY;

      const brighten =
        startOpacity +
        (1 - startOpacity) * Math.min(1, t / FLIGHT_BRIGHTEN_END);
      const fade =
        t < FLIGHT_FADE_START
          ? 1
          : 1 - (t - FLIGHT_FADE_START) / (1 - FLIGHT_FADE_START);
      const opacity = brighten * fade;

      if (ref.current) {
        ref.current.style.transform = `translate(${x}px, ${y}px)`;
        ref.current.style.opacity = String(opacity);
      }
      if (t < 1) raf = requestAnimationFrame(tick);
      else onLandRef.current();
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [startX, startY, arc, startOpacity]);

  return (
    <div
      ref={ref}
      className="wallet-flyer"
      // Match the grabbed element before the first frame so there's no pop.
      style={{
        transform: `translate(${startX}px, ${startY}px)`,
        opacity: startOpacity,
      }}
    >
      {children}
    </div>
  );
}
