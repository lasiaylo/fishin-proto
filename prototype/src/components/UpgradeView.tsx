import { Flex, Tabs } from "@radix-ui/themes";
import React from "react";
import {
  buyItem,
  UpgradeT,
  useUnlockedUpgrades,
  useUpgrade,
} from "../stores/upgradeStore";
import { HoverButton } from "./HoverButton";
import _ from "lodash";

const UPGRADES: { [key: string]: UpgradeT[] } = {
  Upgrades: [UpgradeT.AnotherOven, UpgradeT.NthDegree, UpgradeT.GlassBottle],
  Jimby: [UpgradeT.Deliverer, UpgradeT.Parks, UpgradeT.Population],
};

export function UpgradeView() {
  const unlocked = new Set(Object.keys(useUnlockedUpgrades()));
  const upgrades: { [k: string]: UpgradeT[] } = _.pickBy(
    UPGRADES,
    (upgrades: UpgradeT[]) => upgrades.some((v) => unlocked.has(v)),
  );
  if (Object.keys(upgrades).length === 0) {
    return <></>;
  }
  return (
    <Tabs.Root defaultValue={Object.keys(upgrades)[0]}>
      <Tabs.List color={"orange"}>
        {Object.keys(upgrades).map((tab) => (
          <Tabs.Trigger key={tab} value={tab}>
            {tab}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      {Object.entries(upgrades).map(([tab, upgrades]) => (
        <Tabs.Content key={tab} value={tab} className={"fade-in"}>
          <Flex mt={"3"}>
            <BuyableView buyables={upgrades} />
          </Flex>
        </Tabs.Content>
      ))}
    </Tabs.Root>
  );
}

export function BuyableView({ buyables }: { buyables: UpgradeT[] }) {
  return (
    <Flex direction={"column"} gap={"3"}>
      {buyables.map((type, i) => (
        <UpgradeButton key={`${type}-${i}`} type={type} />
      ))}
    </Flex>
  );
}

export function UpgradeButton({ type }: { type: UpgradeT }) {
  const { amount, flavor, effect, costs, unlocked } = useUpgrade(
    (s) => s[type],
  );
  return (
    <HoverButton
      key={type}
      onClick={() => buyItem(type)}
      label={type}
      gameAction={{
        flavor: flavor,
        effect: effect,
        costs: costs,
      }}
      amount={amount}
      isVisible={unlocked}
    />
  );
}
