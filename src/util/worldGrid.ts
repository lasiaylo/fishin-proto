// The world images (grass, pond, …) sit in a 3x3 grid of square cells.
// Positions are in px relative to the main layout, which the
// CollectableLayer also covers, so collectables can anchor to a cell.
export const CELL_SIZE = 166;
const GRID_ORIGIN = { left: 225, top: 0 };

export interface GridCell {
  row: number;
  col: number;
}

export const GRASS_CELL: GridCell = { row: 0, col: 0 };
export const POND_CELL: GridCell = { row: 1, col: 1 };

// Top-left corner of a cell.
export function cellPos({ row, col }: GridCell) {
  return {
    left: GRID_ORIGIN.left + col * CELL_SIZE,
    top: GRID_ORIGIN.top + row * CELL_SIZE,
  };
}
