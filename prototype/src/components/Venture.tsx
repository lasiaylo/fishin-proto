import { Flex, Text } from "@radix-ui/themes";
import React, { useEffect, useRef, useState } from "react";
import "../styles/noise.scss";
import { addStamina, useVenture } from "../stores/ventureStore";

const TILES = [" ", " ", " ", " ", ";", ","];
const MAP_SIZE = 100;
const HOME = Math.floor(MAP_SIZE / 2);
const WORLD_MAP = Array(MAP_SIZE)
  .fill("_")
  .map((_, i) =>
    Array(MAP_SIZE)
      .fill(0)
      .map((_, j) => TILES[Math.floor(Math.random() * TILES.length)]),
  );
WORLD_MAP[HOME][HOME] = "⌂";

const ASCII_MAP: { [key: string]: string } = {
  " ": "Plains",
  ",": "Fields",
  ";": "Forests",
  "⌂": "Home",
};
const VIEW_DISTANCE = 6;
const PLAYER = "@";

export function VentureView() {
  const [x, setX] = useState(HOME);
  const [y, setY] = useState(HOME);
  const isMounted = useRef(false);
  const stamina = useVenture((s) => s.stamina);

  useEffect(() => {
    if (isMounted.current) {
      addStamina(-1);
    }
  }, [x, y]);

  useEffect(() => {
    isMounted.current = true;
    const traverse = (e: any) => {
      switch (e.key) {
        case "ArrowDown":
          setY((y) => Math.min(y + 1, MAP_SIZE - 1));
          break;
        case "ArrowUp":
          setY((y) => Math.max(y - 1, 0));
          break;
        case "ArrowLeft":
          setX((x) => Math.max(x - 1, 0));
          break;
        case "ArrowRight":
          setX((x) => Math.min(x + 1, MAP_SIZE - 1));
          break;
      }
    };
    window.addEventListener("keydown", traverse);
    return () => {
      window.removeEventListener("keydown", traverse);
      isMounted.current = false;
    };
  }, []);

  return (
    <Flex
      height="100%"
      flexGrow="1"
      justify={"center"}
      className="venture-container fade-in"
      align={"center"}
    >
      <Text>{`Stamina: ${stamina}`}</Text>
      <Flex direction={"column"} justify={"center"} width={"280px"}>
        <WorldMap x={x} y={y} />
      </Flex>
    </Flex>
  );
}

function WorldMap({ x, y }: { x: number; y: number }) {
  const [left, right] = [
    Math.max(0, x - VIEW_DISTANCE),
    Math.min(MAP_SIZE - 1, x + VIEW_DISTANCE),
  ];
  const [top, bottom] = [
    Math.max(0, y - VIEW_DISTANCE),
    Math.min(MAP_SIZE - 1, y + VIEW_DISTANCE),
  ];

  const mapView = WORLD_MAP.slice(top, bottom + 1).map((arr) =>
    arr.slice(left, right + 1),
  );

  let locX = Math.floor(mapView[0].length / 2);
  if (x - left < VIEW_DISTANCE) locX = x;
  if (right - x < VIEW_DISTANCE) {
    locX = x - left;
  }
  const locY =
    y - bottom + 1 < VIEW_DISTANCE ? y - top : Math.floor(mapView.length / 2);
  const tile = mapView[locY][locX];
  mapView[locY][locX] = PLAYER;

  return (
    <Flex
      position={"absolute"}
      direction={"column"}
      width={"300px"}
      height={"300px"}
      align={"center"}
      justify={"center"}
    >
      <Flex className="world-map" direction={"column"}>
        <Flex direction={"column"}>
          {mapView.map((arr, i) => (
            <Flex>
              {arr.map((tile, j) => (
                <pre key={`${i}-${j}`} className={"world-tile"}>
                  {tile}
                </pre>
              ))}
            </Flex>
          ))}
        </Flex>
      </Flex>
      <Flex align={"start"} mt={"3"}>
        <Text color={"lime"}>{ASCII_MAP[tile]}</Text>
      </Flex>
    </Flex>
  );
}
