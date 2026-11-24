export const TREE_RAIL = {
  chipHeight: 18,
  clearance: 8,
  stripGap: 2,
} as const;

export type TreeRailCard = {
  height: number;
  width: number;
  x: number;
  y: number;
};

export type TreeRailPlacement =
  | { kind: "hidden" }
  | { kind: "row"; left: number; top: number }
  | { kind: "strip"; left: number; top: number };

export type TreeRailTransform = {
  x: number;
  y: number;
  zoom: number;
};

export function toTreeRailPlacement({
  cards,
  labelWidth,
  left,
  rowStep,
  rowY,
  transform,
}: {
  cards: readonly TreeRailCard[];
  labelWidth: number;
  left: number;
  rowStep: number;
  rowY: number;
  transform: TreeRailTransform;
}): TreeRailPlacement {
  const { x, y, zoom } = transform;
  const isBlocked = cards.some((card) => {
    const cardLeft = card.x * zoom + x;
    const cardRight = (card.x + card.width) * zoom + x;
    return (
      cardRight > left - TREE_RAIL.clearance && cardLeft < left + labelWidth + TREE_RAIL.clearance
    );
  });
  if (!isBlocked) return { kind: "row", left, top: rowY * zoom + y };
  const stripTop = rowY - rowStep / 2;
  const cardTop = Math.min(...cards.map((card) => card.y));
  if ((cardTop - stripTop) * zoom < TREE_RAIL.chipHeight + TREE_RAIL.stripGap * 2) {
    return { kind: "hidden" };
  }
  return { kind: "strip", left, top: ((stripTop + cardTop) / 2) * zoom + y };
}

export function toTreeRailRowCards({
  cards,
  rowStep,
  rowY,
}: {
  cards: readonly TreeRailCard[];
  rowStep: number;
  rowY: number;
}): TreeRailCard[] {
  return cards.filter((card) => Math.abs(card.y + card.height / 2 - rowY) < rowStep / 2);
}
