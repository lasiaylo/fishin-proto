import React from "react";
import HoverPopover from "./general/HoverPopover";
import { Flex, Text } from "@radix-ui/themes";
import { useDetailedCosts } from "../util/Costs";
import { DescriptionView } from "./general/DescriptionView";
import { GameAction } from "../stores/actionStore";
import { getRTDisplay } from "./ResourceView";
import { GRAY } from "./styleConstants";

export function HoverButton({
  onClick,
  disabled,
  label,
  children,
  gameAction,
  style,
  amount,
  popoverEnabled,
  isVisible,
}: {
  onClick: () => void;
  label: string;
  children?: React.ReactNode;
  gameAction?: GameAction;
  disabled?: boolean;
  style?: any;
  amount?: number;
  popoverEnabled?: boolean;
  isVisible?: boolean;
}) {
  let popover;
  let everyAtCost = true;
  let costLabel;
  if (gameAction) {
    const { costs, flavor, effect } = gameAction;
    let detailedCosts;
    if (costs !== undefined) {
      detailedCosts = useDetailedCosts(costs, amount);
      everyAtCost = Object.values(detailedCosts).every((v) => v.atCost);
      costLabel = Object.entries(detailedCosts).map(
        ([rt, { calculatedCost, atCost }], i, arr) => {
          const style = atCost ? undefined : { color: "var(--red-a8)" };
          if (calculatedCost === 0) return;
          return (
            <span key={i}>
              {i !== 0 && <span> | </span>}
              <Text
                style={style}
              >{`${getRTDisplay(rt)} ${calculatedCost}`}</Text>
            </span>
          );
        },
      );
    }
    popover =
      (popoverEnabled ?? true) ? (
        <DescriptionView
          costs={detailedCosts}
          effect={effect}
          flavor={flavor}
        />
      ) : undefined;
  }

  if (isVisible === undefined || !isVisible) return;
  return (
    <HoverPopover
      triggerContent={
        <button
          onClick={onClick}
          disabled={(disabled ?? false) || !everyAtCost}
          style={{
            background: "white",
            borderRadius: "var(--radius-3)",
            borderColor: GRAY,
            borderWidth: "1px",
            borderStyle: "solid",
            ...style,
          }}
        >
          <Flex direction={"column"} align={"start"} px="1" py="1">
            <Flex justify={"between"} align={"baseline"}>
              <Text size={"3"}>{label}</Text>
              <Text ml="3" size={"1"}>
                {costLabel}
              </Text>
              {amount !== undefined && (
                <Text ml="3" size={"1"} color={"gray"}>
                  {amount}
                </Text>
              )}
            </Flex>

            {children}
          </Flex>
        </button>
      }
      popoverContent={popover}
    />
  );
}
