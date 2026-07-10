import React, { useEffect, useRef, useState } from "react";

export function animationDuration(delta: number): number {
  return Math.min(600, Math.abs(delta) * 60);
}

export function useAnimatedNumber(
  value: number,
  initial?: number,
  delayMs = 0,
): number {
  const [display, setDisplay] = useState(initial ?? value);
  const displayRef = useRef(initial ?? value);

  useEffect(() => {
    const start = displayRef.current;
    const delta = value - start;
    if (delta === 0) return;

    let rafId: number;
    let timeoutId: ReturnType<typeof setTimeout>;

    const animate = () => {
      const duration = animationDuration(delta);
      const startTime = performance.now();
      const tick = (now: number) => {
        const progress = Math.min((now - startTime) / duration, 1);
        const current = Math.round(start + delta * progress);
        displayRef.current = current;
        setDisplay(current);
        if (progress < 1) rafId = requestAnimationFrame(tick);
      };
      rafId = requestAnimationFrame(tick);
    };

    if (delayMs > 0) {
      timeoutId = setTimeout(animate, delayMs);
    } else {
      animate();
    }

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timeoutId);
    };
  }, [value, delayMs]);

  return display;
}

export function AnimatedNumber({
  value,
  initial,
  delay,
}: {
  value: number;
  initial?: number;
  delay?: number;
}) {
  return <>{useAnimatedNumber(value, initial, delay)}</>;
}
