import { Box, Code, Flex, Progress, Separator, Text } from "@radix-ui/themes";
import React, { useEffect, useRef, useState } from "react";
import { usePlayer } from "../stores/playerStore";
import { useDreamStore } from "../stores/dreamStore";
import {
  getPassivePaidTotal,
  usePassiveRate,
} from "../stores/passiveIncomeStore";
import {
  computeDreamPoints,
  computeDreamPointsProgress,
  CURRENCY_SYMBOL,
  WALLET_CAPACITY,
  DREAM_POINT_SYMBOL,
} from "../util/constants";
import { AnimatedNumber } from "./AnimatedNumber";

// Lets effects elsewhere (e.g. collected grass particles) aim at the wallet.
export const CURRENCY_TARGET_ID = "currency-wallet";

export function CurrencyView() {
  const wallet = usePlayer((s) => s.wallet);
  const passiveRate = usePassiveRate("money");
  const cumulativeMoneyEarned = useDreamStore((s) => s.cumulativeMoneyEarned);
  const lvl = computeDreamPoints(cumulativeMoneyEarned);
  const lvlProgress = computeDreamPointsProgress(cumulativeMoneyEarned);
  const lvlProgressPct = Math.round(lvlProgress.fraction * 100);

  const prevWalletRef = useRef(wallet);
  const prevPassiveRef = useRef(getPassivePaidTotal("money"));
  const [popup, setPopup] = useState<{ amount: number; key: number } | null>(
    null,
  );

  useEffect(() => {
    // Passive income ticks constantly, so leave it out of the popup.
    const passivePaid = getPassivePaidTotal("money");
    const diff =
      wallet - prevWalletRef.current - (passivePaid - prevPassiveRef.current);
    prevWalletRef.current = wallet;
    prevPassiveRef.current = passivePaid;
    if (diff > 0) {
      // Sum earnings while the popup is still up; a new key restarts the fade.
      setPopup((p) => ({ amount: (p?.amount ?? 0) + diff, key: Date.now() }));
    }
  }, [wallet]);

  return (
    <Flex direction="row" align="center" gap="4" px="4">
      <Box position="relative" id={CURRENCY_TARGET_ID}>
        {/* Last-baseline alignment puts each label's text baseline on the
            bottom edge of the bar (the column's last item). */}
        <Flex direction="row" gap="2" style={{ alignItems: "last baseline" }}>
          <Text size="2" color="gray">
            {CURRENCY_SYMBOL}
          </Text>
          <Flex direction="column" gap="1" width="160px">
            <Flex justify="end">
              <Text size="1" color="gray">
                <AnimatedNumber value={wallet} /> / {WALLET_CAPACITY}
              </Text>
            </Flex>
            <Progress
              radius="none"
              size="3"
              value={Math.min(100, (wallet / WALLET_CAPACITY) * 100)}
            />
          </Flex>
          {passiveRate > 0 && (
            <Text size="1" color="gray">
              +{passiveRate}/s
            </Text>
          )}
        </Flex>
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
      <Separator orientation="vertical" size="2" />
      <Flex direction="row" align="center" gap="2" width="140px">
        <Text size="2" color="gray">
          {`${DREAM_POINT_SYMBOL} ${lvl}`}
        </Text>
        <Progress radius="none" size="2" value={lvlProgressPct} />
      </Flex>
    </Flex>
  );
}
