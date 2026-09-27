import React, { ReactNode, useEffect, useRef, useState } from "react";
import { Box, Button, Text } from "@radix-ui/themes";
import { BUTTON_FILL_COLOR } from "../util/constants";

interface CooldownButtonProps {
  children: ReactNode;
  readyAt: number;
  cooldownMs: number;
  onFire: () => void;
  width?: number;
}

function isReadyAt(readyAt: number): boolean {
  return Date.now() >= readyAt;
}

function fillPercentAt(readyAt: number, cooldownMs: number): number {
  if (isReadyAt(readyAt)) return 0;
  const remaining = readyAt - Date.now();
  return 100 * (1 - remaining / cooldownMs);
}

// The button doesn't own its cooldown — readyAt is a timestamp the caller's
// store holds, so it stays correct even if this component unmounts and
// remounts mid-cooldown. This only animates the fill against it. The fill
// tracks time spent waiting, not readiness, so it drops back to empty the
// instant the button becomes pressable again instead of sitting full.
export function CooldownButton({
  children,
  readyAt,
  cooldownMs,
  onFire,
  width,
}: CooldownButtonProps) {
  const [ready, setReady] = useState(() => isReadyAt(readyAt));
  const [fillPercent, setFillPercent] = useState(() =>
    fillPercentAt(readyAt, cooldownMs),
  );
  const rafRef = useRef<number>(0);

  useEffect(() => {
    function tick() {
      const nowReady = isReadyAt(readyAt);
      setReady(nowReady);
      setFillPercent(nowReady ? 0 : fillPercentAt(readyAt, cooldownMs));
      if (!nowReady) rafRef.current = requestAnimationFrame(tick);
    }
    tick();
    return () => cancelAnimationFrame(rafRef.current);
  }, [readyAt, cooldownMs]);

  return (
    <Box flexGrow={"0"}>
      <Button
        radius="none"
        variant="outline"
        disabled={!ready}
        onClick={onFire}
        style={{
          background: `linear-gradient(90deg, ${BUTTON_FILL_COLOR} ${fillPercent}%, transparent ${fillPercent}%)`,
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
