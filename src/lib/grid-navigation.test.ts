import { describe, expect, it } from "vitest";
import { isGridKey, moveFocus, type GridShape } from "./grid-navigation";

// Three people across a 24 hour day: the shape the heat grid actually uses.
const shape: GridShape = { columns: 24, rows: 3 };

describe("moveFocus", () => {
  it("moves along a row", () => {
    expect(moveFocus(5, "ArrowRight", shape)).toBe(6);
    expect(moveFocus(5, "ArrowLeft", shape)).toBe(4);
  });

  it("moves between rows by a whole row", () => {
    expect(moveFocus(5, "ArrowDown", shape)).toBe(29);
    expect(moveFocus(29, "ArrowUp", shape)).toBe(5);
  });

  it("stops at the edges instead of wrapping", () => {
    // Wrapping would put 23:00 next to midnight, which reads as a jump.
    expect(moveFocus(0, "ArrowLeft", shape)).toBe(0);
    expect(moveFocus(0, "ArrowUp", shape)).toBe(0);
    expect(moveFocus(23, "ArrowRight", shape)).toBe(23);
    expect(moveFocus(71, "ArrowDown", shape)).toBe(71);
    expect(moveFocus(71, "ArrowRight", shape)).toBe(71);
  });

  it("sends Home and End to the ends of the row, not the grid", () => {
    expect(moveFocus(29, "Home", shape)).toBe(24);
    expect(moveFocus(29, "End", shape)).toBe(47);
    expect(moveFocus(5, "Home", shape)).toBe(0);
  });

  it("sends PageUp and PageDown to the ends of the column", () => {
    expect(moveFocus(29, "PageUp", shape)).toBe(5);
    expect(moveFocus(5, "PageDown", shape)).toBe(53);
  });

  it("copes with a single row or column", () => {
    expect(moveFocus(3, "ArrowDown", { columns: 24, rows: 1 })).toBe(3);
    expect(moveFocus(1, "ArrowRight", { columns: 1, rows: 5 })).toBe(1);
    expect(moveFocus(1, "ArrowDown", { columns: 1, rows: 5 })).toBe(2);
  });

  it("clamps a position that is out of range", () => {
    expect(moveFocus(-4, "ArrowRight", shape)).toBe(1);
    expect(moveFocus(999, "ArrowLeft", shape)).toBe(70);
  });

  it("returns zero for an empty grid", () => {
    expect(moveFocus(0, "ArrowRight", { columns: 0, rows: 0 })).toBe(0);
  });
});

describe("isGridKey", () => {
  it("recognises the keys the grid handles, and no others", () => {
    expect(isGridKey("ArrowLeft")).toBe(true);
    expect(isGridKey("PageDown")).toBe(true);
    expect(isGridKey("Enter")).toBe(false);
    expect(isGridKey("a")).toBe(false);
    expect(isGridKey("Tab")).toBe(false);
  });
});
