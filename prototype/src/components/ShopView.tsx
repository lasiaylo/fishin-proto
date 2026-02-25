import React from "react";
import { Button, Flex } from "@radix-ui/themes";
import {
  useShop,
  buyUpgrade,
  getUpgradePrice,
  isMaxed,
} from "../stores/shopStore";
import { usePlayer } from "../stores/playerStore";

export function ShopView() {
  const upgrades = useShop((s) => s.upgrades);
  const wallet = usePlayer((s) => s.wallet);

  return (
    <Flex p="4" gap="3" wrap="wrap">
      {upgrades.map((upgrade) => {
        const price = getUpgradePrice(upgrade);
        const maxed = isMaxed(upgrade);
        const disabled = maxed || price === null || wallet < price;

        return (
          <Button
            key={upgrade.id}
            disabled={disabled}
            variant="outline"
            onClick={() => buyUpgrade(upgrade.id)}
          >
            {upgrade.id} ({maxed ? "MAX" : `$${price}`})
          </Button>
        );
      })}
    </Flex>
  );
}
