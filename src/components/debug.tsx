import React, { useState } from "react";
import { Flex, Separator, Text, Button } from "@radix-ui/themes";
import { addMoney, usePlayer } from "../stores/playerStore";
import { useShop, buyUpgrade, getUpgradePrice } from "../stores/shopStore";
import { pushEvent } from "../stores/eventLogStore";

export function Debug() {
  return (
    <Flex direction="row" gap="4" p="4" wrap="wrap">
      <MoneySection />
      <EventLogSection />
      <ShopUpgradeSection />
      <StoreView />
    </Flex>
  );
}

function MoneySection() {
  const [value, setValue] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const num = Number(value);
    if (!isNaN(num) && num !== 0) {
      addMoney(num);
      setValue("");
    }
  }

  return (
    <Flex direction="column" gap="2">
      <Text weight="bold">Money</Text>
      <Separator size="4" />
      <form onSubmit={handleSubmit}>
        <Flex gap="2" align="center">
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Amount"
            style={{ width: "80px" }}
          />
          <Button type="submit" size="1">
            Add Money
          </Button>
        </Flex>
      </form>
    </Flex>
  );
}


function EventLogSection() {
  const [value, setValue] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (value.trim()) {
      pushEvent(value.trim());
    }
  }

  return (
    <Flex direction="column" gap="2">
      <Text weight="bold">Event Log</Text>
      <Separator size="4" />
      <form onSubmit={handleSubmit}>
        <Flex gap="2" align="center">
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Message"
            style={{ width: "120px" }}
          />
          <Button type="submit" size="1">
            Post
          </Button>
        </Flex>
      </form>
    </Flex>
  );
}

function ShopUpgradeSection() {
  const upgrades = useShop((s) => s.upgrades);

  function forceBuy(id: string) {
    const state = useShop.getState();
    const idx = state.upgrades.findIndex((u) => u.id === id);
    if (idx === -1) return;

    const upgrade = state.upgrades[idx];
    const price = getUpgradePrice(upgrade);
    if (price === null) return;

    // Force-buy: give enough money, then buy normally
    const wallet = usePlayer.getState().wallet;
    if (wallet < price) {
      addMoney(price - wallet);
    }
    buyUpgrade(id);
  }

  return (
    <Flex direction="column" gap="2">
      <Text weight="bold">Shop Upgrades</Text>
      <Separator size="4" />
      <Flex gap="2" wrap="wrap" direction="column">
        {upgrades.map((u) => (
          <Flex key={u.id} gap="2" align="center">
            <Button
              size="1"
              variant="soft"
              onClick={() => forceBuy(u.id)}
              disabled={u.level >= u.prices.length}
            >
              {u.id}
            </Button>
            <Text size="1">
              Lv {u.level}/{u.prices.length}
            </Text>
          </Flex>
        ))}
      </Flex>
    </Flex>
  );
}

function StoreView() {
  const player = usePlayer();
  const shop = useShop();

  // Convert Set to array for JSON display
  const playerDisplay = {
    ...player,
    ownedLures: Array.from(player.ownedLures),
  };

  return (
    <Flex gap="4">
      <Flex direction="column" width="250px">
        <Text weight="bold">Player</Text>
        <Separator size="4" />
        <pre style={{ fontSize: "12px", overflow: "auto" }}>
          {JSON.stringify(playerDisplay, null, 2)}
        </pre>
      </Flex>
      <Flex direction="column" width="250px">
        <Text weight="bold">Shop</Text>
        <Separator size="4" />
        <pre style={{ fontSize: "12px", overflow: "auto" }}>
          {JSON.stringify(shop, null, 2)}
        </pre>
      </Flex>
    </Flex>
  );
}
