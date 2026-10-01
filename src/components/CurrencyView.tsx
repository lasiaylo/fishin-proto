import { Box, Code, Flex, Progress, Text } from "@radix-ui/themes";
import React, { useEffect, useRef, useState } from "react";
import { usePlayer } from "../stores/playerStore";
import { useDreamStore } from "../stores/dreamStore";
import {
  computeDreamPoints,
  computeDreamPointsProgress,
  CURRENCY_SYMBOL,
  DREAM_POINT_SYMBOL,
} from "../util/constants";
import { AnimatedNumber } from "./AnimatedNumber";

// Lets effects elsewhere (e.g. collected grass particles) aim at the wallet.
export const CURRENCY_TARGET_ID = "currency-wallet";

export function CurrencyView() {
  const wallet = usePlayer((s) => s.wallet);
  const cumulativeMoneyEarned = useDreamStore((s) => s.cumulativeMoneyEarned);
  const lvl = computeDreamPoints(cumulativeMoneyEarned);
  const lvlProgress = computeDreamPointsProgress(cumulativeMoneyEarned);
  const lvlProgressPct = Math.round(lvlProgress.fraction * 100);

  const prevWalletRef = useRef(wallet);
  const [popup, setPopup] = useState<{ amount: number; key: number } | null>(
    null,
  );

  useEffect(() => {
    const diff = wallet - prevWalletRef.current;
    prevWalletRef.current = wallet;
    if (diff > 0) {
      // Sum earnings while the popup is still up; a new key restarts the fade.
      setPopup((p) => ({ amount: (p?.amount ?? 0) + diff, key: Date.now() }));
    }
  }, [wallet]);

  return (
    <Flex direction="row" align="center" gap="4" px="4">
      <Box position="relative" id={CURRENCY_TARGET_ID}>
        <Code size="3">
          {CURRENCY_SYMBOL} <AnimatedNumber value={wallet} />
        </Code>
        {popup && (
          <Code
            key={popup.key}
            size="2"
            color="grass"
            className="sale-popup"
            onAnimationEnd={() => setPopup(null)}
          >
            +{popup.amount}
          </Code>
        )}
      </Box>
      <Flex direction="row" align="center" gap="2" width="140px">
        <Text size="2" color="gray">
          {`${DREAM_POINT_SYMBOL} ${lvl}`}
        </Text>
        <Progress radius="none" size="2" value={lvlProgressPct} />
      </Flex>
    </Flex>
  );
}
