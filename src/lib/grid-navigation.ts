/**
 * Keyboard movement for a two-dimensional grid of cells.
 *
 * A grid of 24 hours × N people puts dozens of buttons in the tab order, which
 * is technically reachable and practically unusable. The accessible pattern is
 * a roving tabindex: one cell is tabbable, and the arrow keys move between
 * them. This is the pure part of that — given where focus is and which key was
 * pressed, where should it go.
 */

export interface GridShape {
  columns: number;
  rows: number;
}

export type GridKey =
  | "ArrowLeft"
  | "ArrowRight"
  | "ArrowUp"
  | "ArrowDown"
  | "Home"
  | "End"
  | "PageUp"
  | "PageDown";

const KEYS = new Set<string>([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Home",
  "End",
  "PageUp",
  "PageDown",
]);

export function isGridKey(key: string): key is GridKey {
  return KEYS.has(key);
}

/**
 * The cell focus should move to, or the current one when the move would leave
 * the grid. Movement deliberately does not wrap: wrapping in a time grid means
 * "midnight" sits next to "23:00 the same day", which reads as a jump.
 */
export function moveFocus(current: number, key: GridKey, shape: GridShape): number {
  const { columns, rows } = shape;
  const total = columns * rows;
  if (total === 0) return 0;

  const clamped = Math.min(Math.max(current, 0), total - 1);
  const column = clamped % columns;
  const row = Math.floor(clamped / columns);

  switch (key) {
    case "ArrowLeft":
      return column === 0 ? clamped : clamped - 1;
    case "ArrowRight":
      return column === columns - 1 ? clamped : clamped + 1;
    case "ArrowUp":
      return row === 0 ? clamped : clamped - columns;
    case "ArrowDown":
      return row === rows - 1 ? clamped : clamped + columns;
    case "Home":
      // Home goes to the start of the row, as it does in a spreadsheet.
      return row * columns;
    case "End":
      return row * columns + (columns - 1);
    case "PageUp":
      return column;
    case "PageDown":
      return (rows - 1) * columns + column;
  }
}
