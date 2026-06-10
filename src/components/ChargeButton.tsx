import React, { ReactNode, useRef, useState } from "react";
import { Button, Text } from "@radix-ui/themes";

interface ChargeButtonProps {
  children: ReactNode;
  onRelease: (chargePercent: number) => void;
  maxHoldMs?: number;
  disabled?: boolean;
}

export function ChargeButton({
  children,
  onRelease,
  maxHoldMs = 3000,
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
      const elapsed = Date.now() - startRef.current;
      setChargePercent(Math.min(100, (elapsed / maxHoldMs) * 100));
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
  }

  function releaseCharge() {
    if (startRef.current === null) return;
    cancelAnimationFrame(rafRef.current);
    const elapsed = Date.now() - startRef.current;
    const pct = Math.min(100, (elapsed / maxHoldMs) * 100);
    startRef.current = null;
    setChargePercent(0);
    onRelease(pct);
  }

  return (
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
      <Text size="1">{children}</Text>
    </Button>
  );
}
