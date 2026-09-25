import React from "react";
import { Flex } from "@radix-ui/themes";
import {
  useShop,
  buyUpgrade,
  getUpgradePrice,
  isMaxed,
} from "../stores/shopStore";
import { sellAllFish, usePlayer } from "../stores/playerStore";
import { useSessionLog } from "../stores/sessionLogStore";
import { pushEvent } from "../stores/eventLogStore";
import { CURRENCY_SYMBOL, Rarity, RARITY_COLOR } from "../util/constants";
import { EventMsg } from "../util/eventMessages";
import { UpgradeCatalogGrid } from "./UpgradeCatalogGrid";
import { MyButton } from "./MyButton";

// Selling used to ride along with switching to the (formerly tab-based) shop
// view. Now that the shop is always on screen, there's no navigation event
// to hang this on, so it's an explicit action instead.
function sellUnlockedFish() {
  const { inventory, wallet, inventorySize, incomeBoostPercent } =
    usePlayer.getState();
  const sold = inventory.filter((fish) => !fish.locked);
  if (sold.length === 0) return;
  useSessionLog.getState().finalizeRound(wallet, {
    inventorySize,
    incomeBoostPercent,
  });
  sellAllFish();
  sold.forEach((fish, i) =>
    setTimeout(() => {
      const msg = EventMsg.SOLD_FISH(fish.fish.name, fish.effectivePrice);
      pushEvent(
        msg[0],
        msg[1],
        RARITY_COLOR[fish.rarity],
        fish.rarity === Rarity.LEGENDARY,
      );
    }, i * 400),
  );
}

export function ShopView() {
  const upgrades = useShop((s) => s.upgrades);
  const wallet = usePlayer((s) => s.wallet);
  const baitInventory = usePlayer((s) => s.baitInventory);
  const hasUnlockedFish = usePlayer((s) =>
    s.inventory.some((fish) => !fish.locked),
  );

  return (
    <Flex direction="column" gap="2">
      <Flex justify="end" pr="4" pt="2">
        <MyButton onClick={sellUnlockedFish} disabled={!hasUnlockedFish}>
          sell
        </MyButton>
      </Flex>
      <UpgradeCatalogGrid
        upgrades={upgrades}
        currency={wallet}
        currencySymbol={CURRENCY_SYMBOL}
        getPrice={getUpgradePrice}
        isMaxed={isMaxed}
        onBuy={buyUpgrade}
        baitInventory={baitInventory}
      />
    </Flex>
  );
}
