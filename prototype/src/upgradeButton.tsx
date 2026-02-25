import { Costs, deductCost, getCalculatedCosts, useAtCost } from "./util/Costs";
import React from "react";
import { Button } from "@radix-ui/themes";
import { randomRange } from "./util/random";
import { useVector } from "./stores/vectorStore";
import { useUpgrade } from "./stores/upgradeStore";
import { getResourceString } from "./components/ResourceView";

export const LAND_PACK = {
  Grass: 10,
  Forest: 4,
  Flower: 1,
};
export const TEST_PACK = {
  Grass: 40,
  Forest: 25,
  Mountain: 20,
  River: 10,
  Flower: 5,
};
export const PACK = {
  Grass: 30,
  Apple: 30,
  Forest: 15,
  Mountain: 15,
  River: 10,
};

const LAND_VALUES = {
  Grass: 1,
  Forest: 4,
  Flower: 10,
  House: 1,
  Shop: 4,
  Monument: 10,
};

const TILE_STATES = {
  Grass: useVector,
  Forest: useVector,
  Flower: useVector,
  House: useUpgrade,
  Shop: useUpgrade,
  Monument: useUpgrade,
};

export const BUILDING_PACK = {
  House: 10,
  Shop: 4,
  Monument: 1,
};

export function pullColor(colors: { [id: string]: number }) {
  let toDraw: string[] = [];
  Object.entries(colors).forEach(([color, amt]) => {
    toDraw = toDraw.concat(Array(amt).fill(color));
  });
  const value = Math.floor(randomRange(0, toDraw.length));
  const color = toDraw[value];
  console.log(color);
  return color;
  // const fn = TILE_STATES[color];
  // if (fn === useVector) {
  //   useVector.setState((s) => {
  //     s[VectorT.Nature].amount += LAND_VALUES[color];
  //     return s;
  //   });
  //   return;
  // }
  // useUpgrade.setState((s) => {
  //   s[UpgradeT.Town].amount += LAND_VALUES[color];
  //   return s;
  // });
}
export function UpgradeButton({
  label,
  cost,
  amount,
  onClick,
  disabled,
}: {
  label: string;
  cost: Costs;
  amount: number;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const atCost = useAtCost(cost, amount);
  const calculatedCosts = getCalculatedCosts(cost, amount);
  const rt = Object.keys(calculatedCosts)[0];
  const costAmount = Object.values(calculatedCosts)[0];
  const allAtCost = Object.values(atCost).every((val) => val);

  // @ts-ignore
  return (
    <Button
      disabled={!(allAtCost && (!disabled ?? allAtCost))}
      onClick={() => {
        if (onClick) onClick();
        deductCost(cost, amount);
      }}
      // @ts-ignore
    >{`${label} (${costAmount} ${getResourceString(rt)})`}</Button>
  );
}
