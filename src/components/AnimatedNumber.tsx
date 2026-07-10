import React, { useEffect, useRef, useState } from "react";

export function useAnimatedNumber(value: number, initial?: number): number {
  const [display, setDisplay] = useState(initial ?? value);
  const displayRef = useRef(initial ?? value);

  useEffect(() => {
    const start = displayRef.current;
    const delta = value - start;
    if (delta === 0) return;

    const duration = Math.min(600, Math.abs(delta) * 60);
    const startTime = performance.now();

    let rafId: number;
    const tick = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const current = Math.round(start + delta * progress);
      displayRef.current = current;
      setDisplay(current);
      if (progress < 1) rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [value]);

  return display;
}

export function AnimatedNumber({
  value,
  initial,
}: {
  value: number;
  initial?: number;
}) {
  return <>{useAnimatedNumber(value, initial)}</>;
}
