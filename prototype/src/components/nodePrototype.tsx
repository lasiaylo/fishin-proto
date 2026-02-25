import React, { useState } from "react";
import { Box, Flex, Grid } from "@radix-ui/themes";
import { setVectorAmount, VectorT } from "../stores/vectorStore";
import { GROWTH_RATE } from "../stores/upgradeStore";
import { RT } from "../stores/resourceStore";
import { deductCost } from "../util/Costs";
import { HoverButton } from "./HoverButton";

const INIT_GRID = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, -1, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, -1, 0, 1, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, -1, 0, 0, 0, 0, 0],
  [0, 0, 0, -1, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, -1, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
];
const GRID_SIZE = `${INIT_GRID.length}`;
const DIRT = 0;
const ROAD = 0.1;
const HOME = 1;
const DESTINATION = -1;

const ICON_MAP = {
  [DIRT]: "⬛️",
  [ROAD]: "⬜️",
  [HOME]: "🏠",
  [DESTINATION]: "🏫",
};

const ROADS_PER_UPGRADE = 4;
const ROAD_COST = {
  [RT.Money]: {
    initCosts: [1],
    growthRate: GROWTH_RATE,
  },
};

export function NodePrototype() {
  const [upgradeLevel, setUpgradeLevel] = useState(0);
  const [grid, setGrid] = useState(INIT_GRID);

  const roadCapacity = upgradeLevel * ROADS_PER_UPGRADE;
  const used_roads = grid.reduce(
    (acc, arr) =>
      acc + arr.reduce((prev, curr) => prev + (curr === ROAD ? 1 : 0)),
    0,
  );

  const onClick = (el: number, i: number, j: number) => {
    if (el !== DIRT && el !== ROAD) return;
    const copy = grid.map((arr) => arr.slice());
    copy[i][j] = el === DIRT && used_roads < roadCapacity ? ROAD : DIRT;
    setGrid(copy);
  };
  const onPurchase = () => {
    deductCost(ROAD_COST, upgradeLevel);
    setUpgradeLevel((lvl) => lvl + 1);
  };

  const rate = getRate(grid);
  setVectorAmount(VectorT.Nature, rate);

  return (
    <Flex direction={"column"} gap={"2"}>
      <Box>{`RATE ${rate}`}</Box>
      <Box>{`ROADS: ${used_roads} / ${roadCapacity}`}</Box>
      <Box>USED ROADS {used_roads}</Box>
      <HoverButton
        onClick={onPurchase}
        label={"Buy Roads"}
        gameAction={{
          flavor: "",
          costs: ROAD_COST,
        }}
        amount={upgradeLevel}
        isVisible={true}
      />
      <Grid columns={GRID_SIZE}>
        {grid.map((arr, i) =>
          arr.map((el, j) => (
            <Box key={`${i}-${j}`} onClick={() => onClick(el, i, j)}>
              {ICON_MAP[el] ?? el}
            </Box>
          )),
        )}
      </Grid>
    </Flex>
  );
}

function getRate(grid: number[][]) {
  const check = grid.map((arr) => arr.slice());
  const DIRS = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];
  const bfs = (
    row: number,
    col: number,
    remaining: number,
    starting = false,
  ) => {
    const visited = Array(check.length)
      .fill(0)
      .map(() => Array(check[0].length).fill(false));
    const queue: number[][] = [[row, col]];
    let total = 0;

    while (queue.length > 0) {
      // @ts-ignore
      const [i, j] = queue.shift();
      DIRS.forEach(([di, dj]) => {
        const [newI, newJ] = [i + di, j + dj];
        if (newI < 0 || newI > check.length) return;
        if (newJ < 0 || newJ > check[0].length) return;
        if (visited[newI][newJ]) return;
        visited[newI][newJ] = true;

        const tile = check[newI][newJ];
        if (tile === DIRT || tile === HOME) return;
        if (tile === DESTINATION) {
          total += 1;
          return;
        }
        queue.push([newI, newJ]);
      });
    }
    return total;
  };
  let total = 0;
  check.forEach((arr, i) => {
    arr.forEach((el, j) => {
      if (el !== HOME) return;
      total += bfs(i, j, 1, true);
    });
  });
  return total;
}
