import React, { ReactNode, useRef, useState } from "react";
import { Box, Button, Text } from "@radix-ui/themes";
import gsap from "gsap";

interface ChargeButtonProps {
  children: ReactNode;
  onRelease: (chargePercent: number) => void;
  maxHoldMs?: number;
  disabled?: boolean;
  width?: number;
}

export function ChargeButton({
  children,
  onRelease,
  width,
  maxHoldMs = 2000,
  disabled = false,
}: ChargeButtonProps) {
  const [chargePercent, setChargePercent] = useState(0);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number>(0);

  function startCharge() {
    if (disabled) return;
    startRef.current = Date.now();
    function tick() {
      if (startRef.current === null) return;
      const t = Math.min(1, (Date.now() - startRef.current) / maxHoldMs);
      setChargePercent(gsap.parseEase("power2.out")(t) * 100);
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
  }

  function releaseCharge() {
    if (startRef.current === null) return;
    cancelAnimationFrame(rafRef.current);
    startRef.current = null;
    onRelease(Math.min(100, chargePercent));
    setChargePercent(0);
  }

  return (
    <Box flexGrow={"0"}>
      <Button
        radius="none"
        variant="outline"
        disabled={disabled}
        onPointerDown={startCharge}
        onPointerUp={releaseCharge}
        onPointerCancel={releaseCharge}
        onPointerLeave={releaseCharge}
        style={{
          background: `linear-gradient(90deg, white ${chargePercent}%, transparent ${chargePercent}%)`,
        }}
      >
        <Box width={`${width ?? 0}px`}>
          <Text size="1">{children}</Text>
        </Box>
      </Button>
    </Box>
  );
}
