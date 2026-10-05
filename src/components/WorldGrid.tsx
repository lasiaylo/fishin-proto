import React from "react";
import { Box } from "@radix-ui/themes";
import { CELL_SIZE, cellPos, GridCell } from "../util/worldGrid";

// One cell of the 3x3 world grid; children are centered within it.
export function GridCellBox({
  cell,
  children,
}: {
  cell: GridCell;
  children: React.ReactNode;
}) {
  const { left, top } = cellPos(cell);
  return (
    <Box
      position="absolute"
      left={`${left}px`}
      top={`${top}px`}
      width={`${CELL_SIZE}px`}
      height={`${CELL_SIZE}px`}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {children}
    </Box>
  );
}
