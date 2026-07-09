import { Code, Flex, Text } from "@radix-ui/themes";
import React, { useEffect, useRef, useState } from "react";
import { usePlayer } from "../stores/playerStore";
import { useBaitData } from "../stores/baitStore";
import { useShop } from "../stores/shopStore";
import { CURRENCY_SYMBOL, RARITY_COLOR } from "../util/constants";
import { StatName } from "../util/csvLoader";

export function InventoryView() {
  const wallet = usePlayer((s) => s.wallet);
  const inventory = usePlayer((s) => s.inventory);
  const inventorySize = usePlayer((s) => s.inventorySize);
  const baitInventory = usePlayer((s) => s.baitInventory);
  const baitData = useBaitData((s) => s.baitData);
  const ownedLures = usePlayer((s) => s.ownedLures);
  const upgrades = useShop((s) => s.upgrades);
  const lures = upgrades.filter(
    (u) => u.stat === StatName.LURE && ownedLures.has(u.id),
  );

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
            <Code
              key={i}
              size="1"
              color={item ? RARITY_COLOR[item.rarity] : "gray"}
            >
              {item ? `${item.fish.name}` : "—"}
            </Code>
          );
        })}
      </Flex>

      <Flex direction="column" gap="2">
        <Text size="1" color="gray" weight={"medium"}>
          tackle box
        </Text>
        <Flex direction="column" gap="1">
          <Text size="1" color="gray">
            bait
          </Text>
          <Flex direction="column" gap="1">
            {Object.entries(baitInventory).map(([id, count]) => {
              const bait = baitData.find((b) => b.id === id);
              return (
                <Code key={id} size="1" color={count > 0 ? "gray" : "red"}>
                  {bait?.name ?? id} ×{count}
                </Code>
              );
            })}
          </Flex>
        </Flex>

        {lures.length > 0 && (
          <Flex direction="column" gap="1">
            <Text size="1" color="gray">
              lures
            </Text>
            <Flex direction="column" gap="1">
              {lures.map((lure) => (
                <Code key={lure.id} size="1" color="gray">
                  {lure.name}
                </Code>
              ))}
            </Flex>
          </Flex>
        )}
      </Flex>
    </Flex>
  );
}
