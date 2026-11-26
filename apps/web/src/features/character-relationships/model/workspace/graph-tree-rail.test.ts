import { describe, expect, it } from "vitest";

import type { TreeRailCard } from "./graph-tree-rail";

import { toTreeRailPlacement, toTreeRailRowCards, TREE_RAIL } from "./graph-tree-rail";

const ROW_STEP = 152;

const ROW_Y = 300;

const CARD: TreeRailCard = { height: 64, width: 212, x: 400, y: ROW_Y - 32 };

const IDENTITY = { x: 0, y: 0, zoom: 1 };

describe("toTreeRailPlacement", () => {
  it("keeps the label in its row while the row has room on the left", () => {
    expect(
      toTreeRailPlacement({
        cards: [CARD],
        labelWidth: 110,
        left: 12,
        rowStep: ROW_STEP,
        rowY: ROW_Y,
        transform: IDENTITY,
      }),
    ).toEqual({ kind: "row", left: 12, top: ROW_Y });
  });

  it("moves the label above the cards once a card reaches it", () => {
    const placement = toTreeRailPlacement({
      cards: [{ ...CARD, x: 60 }],
      labelWidth: 110,
      left: 12,
      rowStep: ROW_STEP,
      rowY: ROW_Y,
      transform: IDENTITY,
    });

    expect(placement.kind).toBe("strip");
    if (placement.kind !== "strip") return;
    expect(placement.top + TREE_RAIL.chipHeight / 2).toBeLessThanOrEqual(CARD.y);
    expect(placement.top - TREE_RAIL.chipHeight / 2).toBeGreaterThanOrEqual(ROW_Y - ROW_STEP / 2);
  });

  it("keeps a clearance between the label and the first card", () => {
    const placement = toTreeRailPlacement({
      cards: [{ ...CARD, x: 12 + 110 + TREE_RAIL.clearance - 1 }],
      labelWidth: 110,
      left: 12,
      rowStep: ROW_STEP,
      rowY: ROW_Y,
      transform: IDENTITY,
    });

    expect(placement.kind).toBe("strip");
  });

  it("follows pan and zoom when it checks the cards", () => {
    const transform = { x: -500, y: 40, zoom: 2 };

    expect(
      toTreeRailPlacement({
        cards: [CARD],
        labelWidth: 110,
        left: 12,
        rowStep: ROW_STEP,
        rowY: ROW_Y,
        transform,
      }),
    ).toEqual({ kind: "row", left: 12, top: ROW_Y * 2 + 40 });
  });

  it("hides the label when a card blocks it and the gap above is too small to read", () => {
    expect(
      toTreeRailPlacement({
        cards: [{ ...CARD, x: 0 }],
        labelWidth: 110,
        left: 12,
        rowStep: ROW_STEP,
        rowY: ROW_Y,
        transform: { x: 0, y: 0, zoom: 0.3 },
      }),
    ).toEqual({ kind: "hidden" });
  });
});

describe("toTreeRailRowCards", () => {
  it("takes only the cards whose centre lies in the row", () => {
    const above = { ...CARD, y: CARD.y - ROW_STEP };
    const below = { ...CARD, y: CARD.y + ROW_STEP };

    expect(
      toTreeRailRowCards({ cards: [above, CARD, below], rowStep: ROW_STEP, rowY: ROW_Y }),
    ).toEqual([CARD]);
  });
});
