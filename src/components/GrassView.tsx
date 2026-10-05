import React from "react";
import { CELL_SIZE, GRASS_CELL } from "../util/worldGrid";
import { GridCellBox } from "./WorldGrid";

export function GrassView() {
  return (
    <GridCellBox cell={GRASS_CELL}>
      <img
        src="/grass.png"
        alt=""
        style={{
          display: "block",
          maxWidth: CELL_SIZE,
          maxHeight: CELL_SIZE,
          objectFit: "contain",
        }}
      />
    </GridCellBox>
  );
}
