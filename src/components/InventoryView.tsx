import { Code, Flex, Select, Text } from "@radix-ui/themes";
import React, { useEffect, useRef, useState } from "react";
import { setSelectedLure, usePlayer } from "../stores/playerStore";
import { useShop } from "../stores/shopStore";
import { StatName } from "../util/csvLoader";

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

    const duration = Math.min(600, Math.abs(delta) * 50);
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
      <Flex position="relative" style={{ display: "inline-flex" }}>
        <Code size="2">${displayWallet}</Code>
        {popup && (
          <Code
            key={popup.key}
            size="2"
            color="green"
            className="sale-popup"
            onAnimationEnd={() => setPopup(null)}
          >
            +${popup.amount}
          </Code>
        )}
      </Flex>
      <Flex direction="column" gap="1">
        <Text size="1" color="gray">
          fish cooler
        </Text>
        {Array.from({ length: inventorySize }).map((_, i) => {
          const fish = inventory[i];
          return (
            <Code key={i} size="1" color={fish ? undefined : "gray"}>
              {fish ? `${fish.name}` : "—"}
            </Code>
          );
        })}
      </Flex>
      <Flex direction="column" gap="2">
        <Text size="1">lure</Text>
        <Select.Root
          size="1"
          value={selectedLure ?? "__none__"}
          onValueChange={(v) => setSelectedLure(v === "__none__" ? null : v)}
        >
          <Select.Trigger variant={"soft"} />
          <Select.Content>
            <Select.Item value="__none__">none</Select.Item>
            {ownedLureList.map((u) => (
              <Select.Item key={u.id} value={u.id}>
                {u.name}
              </Select.Item>
            ))}
          </Select.Content>
        </Select.Root>
      </Flex>
    </Flex>
  );
}
