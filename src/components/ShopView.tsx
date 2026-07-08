import React from "react";
import { Box, Flex, Grid, Text } from "@radix-ui/themes";
import {
  useShop,
  buyUpgrade,
  getUpgradePrice,
  isMaxed,
} from "../stores/shopStore";
import { usePlayer } from "../stores/playerStore";
import { useBaitData } from "../stores/baitStore";
import { MyButton } from "./MyButton";
import { BAIT_MAX_STACK, CURRENCY_SYMBOL } from "../util/constants";
import { StatName } from "../util/csvLoader";

const CATEGORY_ORDER = ["lures", "rod upgrades", "bait", "misc"];

function rodGroupKey(id: string): string | null {
  if (id.startsWith("ROD_ATTACK_") || id.startsWith("ROD_DEFENSE_")) {
    const parts = id.split("_");
    return `${parts[parts.length - 2]}_${parts[parts.length - 1]}`;
  }
  return null;
}

function LevelPips({ level, maxLevel }: { level: number; maxLevel: number }) {
  if (maxLevel <= 1) return null;
  return (
    <Flex gap="1" mt="1">
      {Array.from({ length: maxLevel }, (_, i) => (
        <Box
          key={i}
          width="6px"
          height="6px"
          style={{
            borderRadius: "9999px",
            backgroundColor:
              i < level ? "var(--accent-9)" : "var(--gray-a5)",
          }}
        />
      ))}
    </Flex>
  );
}

export function ShopView() {
  const upgrades = useShop((s) => s.upgrades);
  const wallet = usePlayer((s) => s.wallet);
  const baitInventory = usePlayer((s) => s.baitInventory);
  const baitData = useBaitData((s) => s.baitData);

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
      {groups.map(({ label, upgrades: group }) => {
        if (label === "rod upgrades") {
          const byGroup = new Map<string | null, typeof group>();
          for (const u of group) {
            const key = rodGroupKey(u.id);
            if (!byGroup.has(key)) byGroup.set(key, []);
            byGroup.get(key)!.push(u);
          }

          return (
            <Flex key={label} direction="column" gap="2">
              <Text size="2" weight="bold" color="gray">
                {label}
              </Text>
              {[...byGroup.entries()].map(([key, subGroup]) => (
                <Flex key={key ?? "misc"} direction="column" gap="1">
                  {key && (
                    <Text size="1" color="gray">
                      {key.replace("_", " ").toLowerCase()}
                    </Text>
                  )}
                  <Grid columns="2" gapY="3" gapX="8">
                    {subGroup.map((upgrade) => {
                      const price = getUpgradePrice(upgrade);
                      const maxed = isMaxed(upgrade);
                      const disabled =
                        maxed || price === null || wallet < price;
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
                            <Text size="1">
                              {maxed ? "max" : `${CURRENCY_SYMBOL} ${price}`}
                            </Text>
                            <LevelPips
                              level={upgrade.level}
                              maxLevel={upgrade.prices.length}
                            />
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

        return (
          <Flex key={label} direction="column" gap="2">
            <Text size="2" weight="bold" color="gray">
              {label}
            </Text>
            <Grid columns="2" gapY="3" gapX="8">
              {group.map((upgrade) => {
                const price = getUpgradePrice(upgrade);
                const isBait = upgrade.stat === StatName.BAIT;
                const baitCount = isBait
                  ? (baitInventory[upgrade.id] ?? 0)
                  : null;
                const baitFull = isBait && (baitCount ?? 0) >= BAIT_MAX_STACK;
                const maxed = isMaxed(upgrade);
                const disabled =
                  maxed || baitFull || price === null || wallet < price;

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
                      <Text size="1">
                        {baitFull
                          ? "full"
                          : maxed
                            ? "max"
                            : `${CURRENCY_SYMBOL} ${price}`}
                      </Text>
                      {isBait && baitCount !== null && (
                        <Text size="1" color="gray">
                          ×{baitCount}/{BAIT_MAX_STACK}
                        </Text>
                      )}
                      <LevelPips
                        level={upgrade.level}
                        maxLevel={upgrade.prices.length}
                      />
                    </Flex>
                  </MyButton>
                );
              })}
            </Grid>
          </Flex>
        );
      })}
    </Flex>
  );
}
