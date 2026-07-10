import React from "react";
import { useShop, buyUpgrade, getUpgradePrice, isMaxed } from "../stores/shopStore";
import { usePlayer } from "../stores/playerStore";
import { CURRENCY_SYMBOL } from "../util/constants";
import { UpgradeCatalogGrid } from "./UpgradeCatalogGrid";

export function ShopView() {
  const upgrades = useShop((s) => s.upgrades);
  const wallet = usePlayer((s) => s.wallet);
  const baitInventory = usePlayer((s) => s.baitInventory);

  return (
    <UpgradeCatalogGrid
      upgrades={upgrades}
      currency={wallet}
      currencySymbol={CURRENCY_SYMBOL}
      getPrice={getUpgradePrice}
      isMaxed={isMaxed}
      onBuy={buyUpgrade}
      baitInventory={baitInventory}
    />
  );
}
