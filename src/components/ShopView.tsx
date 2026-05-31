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

const CATEGORY_ORDER = ["LURES", "ROD UPGRADES", "MISC"];

export function ShopView() {
  const upgrades = useShop((s) => s.upgrades);
  const wallet = usePlayer((s) => s.wallet);

  const groups = CATEGORY_ORDER.map((cat) => ({
    label: cat,
    upgrades: upgrades.filter((u) => u.category === cat),
  })).filter((g) => g.upgrades.length > 0);

  return (
    <Flex p="4" direction={"column"} gap="4" align={"start"}>
      {groups.map(({ label, upgrades: group }) => (
        <Flex key={label} direction="column" gap="2">
          <Text size="2" weight="bold" color="gray">
            {label}
          </Text>
          {group.map((upgrade) => {
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
      ))}
    </Flex>
  );
}
