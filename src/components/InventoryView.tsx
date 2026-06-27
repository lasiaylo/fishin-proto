import { Code, Flex, Progress, Select, Text } from "@radix-ui/themes";
import React, { useEffect, useRef, useState } from "react";
import { setSelectedLure, usePlayer } from "../stores/playerStore";
import { useShop } from "../stores/shopStore";
import { StatName } from "../util/csvLoader";
import { useLureXp, lureXpProgress } from "../stores/lureXpStore";
import {
  BASE_LURE_ID,
  BASE_LURE_NAME,
  CURRENCY_SYMBOL,
  RARITY_COLOR,
} from "../util/constants";

export function InventoryView() {
  const wallet = usePlayer((s) => s.wallet);
  const inventory = usePlayer((s) => s.inventory);
  const inventorySize = usePlayer((s) => s.inventorySize);
  const ownedLures = usePlayer((s) => s.ownedLures);
  const selectedLure = usePlayer((s) => s.selectedLure);
  const shopUpgrades = useShop((s) => s.upgrades);

  const ownedLureList = shopUpgrades.filter(
    (u) => u.stat === StatName.LURE && ownedLures.has(u.id),
  );
  const lureXpData = useLureXp((s) => s.lures);

  const [displayWallet, setDisplayWallet] = useState(wallet);
  const displayRef = useRef(wallet);
  const prevWalletRef = useRef(wallet);
  const [popup, setPopup] = useState<{ amount: number; key: number } | null>(
    null,
  );

  useEffect(() => {
    const end = wallet;
    const diff = end - prevWalletRef.current;
    prevWalletRef.current = end;

    if (diff > 0) {
      setPopup({ amount: diff, key: Date.now() });
    }

    const start = displayRef.current;
    const delta = end - start;
    if (delta === 0) return;

    const duration = Math.min(600, Math.abs(delta) * 60);
    const startTime = performance.now();

    let rafId: number;
    const tick = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const current = Math.round(start + delta * progress);
      displayRef.current = current;
      setDisplayWallet(current);
      if (progress < 1) rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [wallet]);

  return (
    <Flex
      position={"relative"}
      direction="column"
      flexShrink="0"
      width="200px"
      gap={"6"}
      pt="40px"
    >
      <Flex width={"100%"} direction={"column"}>
        <Code size="2">
          {CURRENCY_SYMBOL} {displayWallet}
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
      </Flex>
      <Flex direction="column" gap="1">
        <Text size="1" color="gray">
          cooler
        </Text>
        {Array.from({ length: inventorySize }).map((_, i) => {
          const item = inventory[i];
          return (
            <Code key={i} size="1" color={item ? RARITY_COLOR[item.rarity] : "gray"}>
              {item ? `${item.fish.name}` : "—"}
            </Code>
          );
        })}
      </Flex>
      <Flex direction="column" gap="2">
        <Text size="1" color={"gray"}>
          lure
        </Text>
        <Select.Root
          size="1"
          value={selectedLure ?? BASE_LURE_ID}
          onValueChange={(v) => setSelectedLure(v)}
        >
          <Select.Trigger variant={"soft"} />
          <Select.Content>
            <Select.Item value={BASE_LURE_ID}>
              <Text color={"gray"}>
                {BASE_LURE_NAME} Lvl. {lureXpData[BASE_LURE_ID]?.level ?? 0}
              </Text>
            </Select.Item>
            {ownedLureList.map((u) => {
              const level = lureXpData[u.id]?.level ?? 0;
              return (
                <Select.Item key={u.id} value={u.id}>
                  <Text color={"gray"}>
                    {u.name} Lvl. {level}
                  </Text>
                </Select.Item>
              );
            })}
          </Select.Content>
        </Select.Root>
        {selectedLure &&
          (() => {
            const entry = lureXpData[selectedLure];
            const xp = entry?.xp ?? 0;
            const level = entry?.level ?? 0;
            const progress = lureXpProgress(xp, level);
            return (
              <Flex align={"center"} gap={"2"}>
                <Text size={"1"} color={"gray"}>
                  xp
                </Text>
                <Progress
                  radius="none"
                  size="2"
                  value={Math.round(progress * 100)}
                />
              </Flex>
            );
          })()}
      </Flex>
    </Flex>
  );
}
