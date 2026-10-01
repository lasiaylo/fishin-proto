import React from "react";
import { Flex, Separator, Text } from "@radix-ui/themes";
import {
  useShop,
  buyUpgrade,
  getUpgradePrice,
  isMaxed,
} from "../stores/shopStore";
import { useActiveTab } from "../stores/tabStore";
import { usePlayer } from "../stores/playerStore";
import { CURRENCY_SYMBOL } from "../util/constants";
import { UpgradeCatalogGrid } from "./UpgradeCatalogGrid";
import { CurrencyView } from "./CurrencyView";

export function ShopView() {
  const tab = useActiveTab((s) => s.tab);
  const upgrades = useShop((s) => s.upgrades);
  const wallet = usePlayer((s) => s.wallet);
  const baitInventory = usePlayer((s) => s.baitInventory);
  const tabUpgrades = upgrades.filter((u) => u.tab === tab);

  return (
    <Flex direction="column" gap="2">
      <CurrencyView />
      <Separator size="4" />
      {/* Keyed on the tab so switching remounts and replays the fade-in. */}
      <Flex key={tab} className={"fade-in"}>
        {tabUpgrades.length > 0 ? (
          <UpgradeCatalogGrid
            upgrades={tabUpgrades}
            allUpgrades={upgrades}
            currency={wallet}
            currencySymbol={CURRENCY_SYMBOL}
            getPrice={getUpgradePrice}
            isMaxed={isMaxed}
            onBuy={buyUpgrade}
            baitInventory={baitInventory}
          />
        ) : (
          <Text size="2" color="gray" m="4">
            nothing for sale yet
          </Text>
        )}
      </Flex>
    </Flex>
  );
}
