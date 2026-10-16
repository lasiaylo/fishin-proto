import React from "react";
import { CELL_SIZE, GRASS_CELL } from "../util/worldGrid";
import { GridCellBox } from "./WorldGrid";

export function GrassView() {
  return (
    <GridCellBox cell={GRASS_CELL}>
      <div style={{ position: "relative" }}>
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
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            boxShadow: "inset 3px 3px 6px rgba(0, 0, 0, 0.6)",
          }}
        />
      </div>
    </GridCellBox>
  );
}
