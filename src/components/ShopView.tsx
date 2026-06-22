import React from "react";
import { Flex, Grid, Text } from "@radix-ui/themes";
import {
  useShop,
  buyUpgrade,
  getUpgradePrice,
  isMaxed,
} from "../stores/shopStore";
import { usePlayer } from "../stores/playerStore";
import { MyButton } from "./MyButton";
import { CURRENCY_SYMBOL } from "../util/constants";

const CATEGORY_ORDER = ["lures", "rod upgrades", "misc"];

export function ShopView() {
  const upgrades = useShop((s) => s.upgrades);
  const wallet = usePlayer((s) => s.wallet);

  const upgradeById = new Map(upgrades.map((u) => [u.id, u]));
  const meetsRequirements = (u: (typeof upgrades)[number]) =>
    u.requirements.length === 0 ||
    u.requirements.every((id) => {
      const req = upgradeById.get(id);
      return req ? isMaxed(req) : true;
    });

  const groups = CATEGORY_ORDER.map((cat) => ({
    label: cat,
    upgrades: upgrades.filter(
      (u) => u.category === cat && meetsRequirements(u) && !isMaxed(u),
    ),
  })).filter((g) => g.upgrades.length > 0);

  return (
    <Flex p="4" direction={"column"} gap="4" align={"start"}>
      {groups.map(({ label, upgrades: group }) => (
        <Flex key={label} direction="column" gap="2">
          <Text size="2" weight="bold" color="gray">
            {label}
          </Text>
          <Grid columns="2" gapY="3" gapX="8">
            {group.map((upgrade) => {
              const price = getUpgradePrice(upgrade);
              const maxed = isMaxed(upgrade);
              const disabled = maxed || price === null || wallet < price;

              return (
                <MyButton
                  key={upgrade.id}
                  disabled={disabled}
                  description={upgrade.description}
                  onClick={() => buyUpgrade(upgrade.id)}
                  minWidth={100}
                >
                  <Flex direction="column">
                    <Text>{upgrade.name}</Text>
                    <Text size="1">{maxed ? "max" : `${CURRENCY_SYMBOL} ${price}`}</Text>
                  </Flex>
                </MyButton>
              );
            })}
          </Grid>
        </Flex>
      ))}
    </Flex>
  );
}
