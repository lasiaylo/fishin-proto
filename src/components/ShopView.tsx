import React from "react";
import { Box, Flex, Text } from "@radix-ui/themes";
import {
  useShop,
  buyUpgrade,
  getUpgradePrice,
  isMaxed,
} from "../stores/shopStore";
import { usePlayer } from "../stores/playerStore";
import { MyButton } from "./MyButton";

export function ShopView() {
  const upgrades = useShop((s) => s.upgrades);
  const wallet = usePlayer((s) => s.wallet);

  return (
    <Flex p="4" direction={"column"} gap="4" wrap="wrap" align={"start"}>
      {upgrades.map((upgrade) => {
        const price = getUpgradePrice(upgrade);
        const maxed = isMaxed(upgrade);
        const disabled = maxed || price === null || wallet < price;

        return (
          <Box key={upgrade.id} maxWidth={"300px"}>
            <MyButton
              disabled={disabled}
              description={upgrade.description}
              onClick={() => buyUpgrade(upgrade.id)}
            >
              {upgrade.name} ({maxed ? "MAX" : `$${price}`})
            </MyButton>
          </Box>
        );
      })}
    </Flex>
  );
}
