import React from "react";
import {
  buyDreamUpgrade,
  getDreamUpgradePrice,
  isDreamUpgradeMaxed,
  useDreamShop,
} from "../stores/dreamShopStore";
import { useDreamStore } from "../stores/dreamStore";
import { DREAM_POINT_SYMBOL } from "../util/constants";
import { UpgradeCatalogGrid } from "./UpgradeCatalogGrid";

export function DreamShopView() {
  const upgrades = useDreamShop((s) => s.upgrades);
  const dreamPoints = useDreamStore((s) => s.dreamPoints);

  return (
    <UpgradeCatalogGrid
      upgrades={upgrades}
      currency={dreamPoints}
      currencySymbol={DREAM_POINT_SYMBOL}
      getPrice={getDreamUpgradePrice}
      isMaxed={isDreamUpgradeMaxed}
      onBuy={buyDreamUpgrade}
    />
  );
}
