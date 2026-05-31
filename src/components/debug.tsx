import React, { useState } from "react";
import { Flex, Separator, Text, Button } from "@radix-ui/themes";
import { setMoney, usePlayer } from "../stores/playerStore";
import { useShop, setUpgradeLevelDebug } from "../stores/shopStore";
import { pushEvent } from "../stores/eventLogStore";

export function Debug() {
  return (
    <Flex direction="row" gap="4" p="4" wrap="wrap">
      <ShopUpgradeSection />
      <StoreView />
      <MoneySection />
      <EventLogSection />
    </Flex>
  );
}

function MoneySection() {
  const [value, setValue] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const num = Number(value);
    if (!isNaN(num) && num >= 0) {
      setMoney(num);
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
            Set Money
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

  return (
    <Flex direction="column" gap="2">
      <Text weight="bold">Shop Upgrades</Text>
      <Separator size="4" />
      <Flex gap="2" wrap="wrap" direction="column">
        {upgrades.map((u) => (
          <Flex key={u.id} gap="2" align="center">
            <Text size="1" style={{ width: "80px" }}>
              {u.id}
            </Text>
            <input
              type="number"
              min={0}
              max={u.prices.length}
              value={u.level}
              onChange={(e) =>
                setUpgradeLevelDebug(u.id, Number(e.target.value))
              }
              style={{ width: "50px" }}
            />
            <Text size="1" color="gray">
              / {u.prices.length}
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
