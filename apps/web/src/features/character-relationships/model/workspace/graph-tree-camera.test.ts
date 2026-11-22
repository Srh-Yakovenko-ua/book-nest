import type { Nullable } from "@app/shared";

import { describe, expect, it } from "vitest";

import type { GraphPersonViewport } from "./graph-person-camera";
import type { TreeCameraBox } from "./graph-tree-camera";

import {
  toTreeBounds,
  toTreeCenterViewport,
  toTreeInitialViewport,
  TREE_CAMERA,
} from "./graph-tree-camera";

const AREA = { height: 600, width: 1000, x: 0, y: 0 };

const ZOOM = { maxZoom: 2, minZoom: 0.1 };

const SMALL_TREE: TreeCameraBox[] = [
  { height: 64, id: "e8e8e8e8-0000-4000-8000-000000000001", width: 200, x: -210, y: -152 },
  { height: 64, id: "e8e8e8e8-0000-4000-8000-000000000002", width: 200, x: 10, y: -152 },
  { height: 64, id: "e8e8e8e8-0000-4000-8000-000000000003", width: 200, x: -100, y: 0 },
];

const SMALL_ROOT = "e8e8e8e8-0000-4000-8000-000000000003";

const HUGE_ROW: TreeCameraBox[] = Array.from({ length: 60 }, (_, index) => ({
  height: 64,
  id: `e9e9e9e9-0000-4000-8000-${String(index).padStart(12, "0")}`,
  width: 200,
  x: index * 228,
  y: 0,
}));

const HUGE_ROW_ROOT = "e9e9e9e9-0000-4000-8000-000000000059";

const HUGE_ROW_FOCUS = [
  { focusIds: new Set(HUGE_ROW.map((box) => box.id)), label: "every character" },
  {
    focusIds: new Set(["e9e9e9e9-0000-4000-8000-000000000058", HUGE_ROW_ROOT]),
    label: "the root and its neighbour",
  },
];

describe("toTreeBounds", () => {
  const boxes: TreeCameraBox[] = [
    { height: 64, id: "eaeaeaea-0000-4000-8000-000000000001", width: 200, x: 0, y: 0 },
    { height: 64, id: "eaeaeaea-0000-4000-8000-000000000002", width: 200, x: 300, y: 100 },
  ];

  it("bounds the boxes tightly without the generation rail", () => {
    expect(toTreeBounds({ boxes, withRail: false })).toEqual({
      height: 164,
      width: 500,
      x: 0,
      y: 0,
    });
  });

  it("widens the bounds to the left by the rail when the rail is shown", () => {
    expect(toTreeBounds({ boxes, withRail: true })).toEqual({
      height: 164,
      width: 500 + TREE_CAMERA.rail,
      x: -TREE_CAMERA.rail,
      y: 0,
    });
  });

  it("has no bounds without boxes", () => {
    expect(toTreeBounds({ boxes: [], withRail: true })).toBeNull();
  });
});

describe("toTreeInitialViewport", () => {
  it("does not zoom a small tree past the camera maximum", () => {
    const viewport = toTreeInitialViewport({
      area: AREA,
      boxes: SMALL_TREE,
      focusIds: new Set([SMALL_ROOT]),
      rootId: SMALL_ROOT,
      zoom: ZOOM,
    });

    expect(viewport?.zoom).toBeLessThanOrEqual(TREE_CAMERA.maxZoom);
  });

  it("fits every box of a small tree inside the area", () => {
    const viewport = toTreeInitialViewport({
      area: AREA,
      boxes: SMALL_TREE,
      focusIds: new Set([SMALL_ROOT]),
      rootId: SMALL_ROOT,
      zoom: ZOOM,
    });

    expect(boxesOutside({ boxes: SMALL_TREE, viewport })).toEqual([]);
  });

  it.each(HUGE_ROW_FOCUS)("keeps a huge row readable with $label in focus", ({ focusIds }) => {
    const viewport = toTreeInitialViewport({
      area: AREA,
      boxes: HUGE_ROW,
      focusIds,
      rootId: HUGE_ROW_ROOT,
      zoom: ZOOM,
    });

    expect(viewport?.zoom).toBeGreaterThanOrEqual(TREE_CAMERA.readableZoom);
  });

  it.each(HUGE_ROW_FOCUS)("shows the root of a huge row with $label in focus", ({ focusIds }) => {
    const viewport = toTreeInitialViewport({
      area: AREA,
      boxes: HUGE_ROW,
      focusIds,
      rootId: HUGE_ROW_ROOT,
      zoom: ZOOM,
    });
    const rootBoxes = HUGE_ROW.filter((box) => box.id === HUGE_ROW_ROOT);

    expect(boxesOutside({ boxes: rootBoxes, viewport })).toEqual([]);
  });
});

describe("toTreeCenterViewport", () => {
  it("puts the centre of the box at the centre of the area", () => {
    const box = { height: 64, width: 200, x: 300, y: -152 };
    const viewport = toTreeCenterViewport({
      area: { height: 600, width: 1000, x: 40, y: 20 },
      box,
      zoom: 0.5,
    });

    expect({
      x: (box.x + box.width / 2) * viewport.zoom + viewport.x,
      y: (box.y + box.height / 2) * viewport.zoom + viewport.y,
    }).toEqual({ x: 540, y: 320 });
  });
});

function boxesOutside({
  boxes,
  viewport,
}: {
  boxes: readonly TreeCameraBox[];
  viewport: Nullable<GraphPersonViewport>;
}): string[] {
  return boxes
    .filter((box) => {
      if (viewport === null) return true;
      const left = box.x * viewport.zoom + viewport.x;
      const top = box.y * viewport.zoom + viewport.y;
      const right = (box.x + box.width) * viewport.zoom + viewport.x;
      const bottom = (box.y + box.height) * viewport.zoom + viewport.y;
      return (
        left < AREA.x ||
        top < AREA.y ||
        right > AREA.x + AREA.width ||
        bottom > AREA.y + AREA.height
      );
    })
    .map((box) => box.id);
}
