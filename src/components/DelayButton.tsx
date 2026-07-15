import React, { ReactNode, useRef, useState } from "react";
import { Box, Button, Text } from "@radix-ui/themes";
import gsap from "gsap";

interface DelayButtonProps {
  children: ReactNode;
  onComplete: () => void;
  delayMs?: number;
  disabled?: boolean;
  width?: number;
}

export function DelayButton({
  children,
  onComplete,
  width,
  delayMs,
  disabled = false,
}: DelayButtonProps) {
  const [chargePercent, setChargePercent] = useState(0);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number>(0);

  function startDelay() {
    if (disabled || startRef.current !== null) return;
    startRef.current = Date.now();
    function tick() {
      if (startRef.current === null) return;
      const t = Math.min(1, (Date.now() - startRef.current) / delayMs);
      setChargePercent(gsap.parseEase("power2.out")(t) * 100);
      if (t >= 1) {
        startRef.current = null;
        setChargePercent(0);
        onComplete();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
  }

  return (
    <Box flexGrow={"0"}>
      <Button
        radius="none"
        variant="outline"
        disabled={disabled}
        onClick={startDelay}
        style={{
          background: `linear-gradient(90deg, white ${chargePercent}%, transparent ${chargePercent}%)`,
          height: "auto",
        }}
      >
        <Box width={`${width ?? 0}px`} py={"2"}>
          <Text size="1">{children}</Text>
        </Box>
      </Button>
    </Box>
  );
}
