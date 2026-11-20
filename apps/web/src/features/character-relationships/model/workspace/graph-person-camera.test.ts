import { describe, expect, it } from "vitest";

import type { GraphPersonArea, GraphPersonBox } from "./graph-person-camera";

import {
  fitGraphPersonBounds,
  toGraphPersonBounds,
  toGraphPersonDetailLevel,
  toGraphPersonInitialViewport,
  toGraphPersonRevealViewport,
} from "./graph-person-camera";

const ZOOM = { maxZoom: 2, minZoom: 0.05 } as const;

const SMALL_AREA: GraphPersonArea = { height: 300, width: 400, x: 0, y: 0 };

const NEAR_BOXES: readonly GraphPersonBox[] = [
  { height: 24, hop: 0, width: 40, x: 0, y: 0 },
  { height: 24, hop: 1, width: 40, x: 96, y: 24 },
];

describe("toGraphPersonDetailLevel", () => {
  it.each([
    { level: "far", zoom: 0.44 },
    { level: "normal", zoom: 0.45 },
    { level: "normal", zoom: 0.69 },
    { level: "detail", zoom: 0.7 },
    { level: "detail", zoom: 1 },
  ])("shows the $level level at zoom $zoom", ({ level, zoom }) => {
    expect(toGraphPersonDetailLevel(zoom)).toBe(level);
  });
});

describe("toGraphPersonBounds", () => {
  it("returns null without boxes", () => {
    expect(toGraphPersonBounds({ boxes: [], ring: null })).toBeNull();
  });

  it("widens a box by 32 px on each side and by 52 px below for the name plate", () => {
    const boxes = [{ height: 100, hop: 0, width: 100, x: 0, y: 0 }];

    expect(toGraphPersonBounds({ boxes, ring: null })).toEqual({
      height: 152,
      width: 164,
      x: -32,
      y: 0,
    });
  });

  it("spans every box with its plate room", () => {
    const boxes = [
      { height: 50, hop: 0, width: 100, x: 0, y: 0 },
      { height: 40, hop: 2, width: 80, x: 200, y: 100 },
    ];

    expect(toGraphPersonBounds({ boxes, ring: null })).toEqual({
      height: 192,
      width: 344,
      x: -32,
      y: 0,
    });
  });

  it("grows to contain a ring larger than the boxes", () => {
    const boxes = [{ height: 100, hop: 0, width: 100, x: 0, y: 0 }];
    const ring = { center: { x: 50, y: 50 }, radius: 300 };

    expect(toGraphPersonBounds({ boxes, ring })).toEqual({
      height: 600,
      width: 600,
      x: -250,
      y: -250,
    });
  });

  it("grows only on the sides where the ring reaches past the plate room", () => {
    const boxes = [{ height: 100, hop: 0, width: 100, x: 0, y: 0 }];
    const ring = { center: { x: 50, y: 50 }, radius: 80 };

    expect(toGraphPersonBounds({ boxes, ring })).toEqual({
      height: 182,
      width: 164,
      x: -32,
      y: -30,
    });
  });
});

describe("fitGraphPersonBounds", () => {
  const area: GraphPersonArea = { height: 600, width: 800, x: 0, y: 0 };

  it("zooms the bounds to fill the padded width and centres them in the area", () => {
    const bounds = { height: 120, width: 320, x: 40, y: -20 };

    expect(fitGraphPersonBounds({ area, bounds, padding: 0.25, zoom: ZOOM })).toEqual({
      x: 150,
      y: 250,
      zoom: 1.25,
    });
  });

  it("zooms by the padded height when the height is the tighter fit", () => {
    const bounds = { height: 240, width: 160, x: 0, y: 0 };

    expect(fitGraphPersonBounds({ area, bounds, padding: 0.25, zoom: ZOOM })).toEqual({
      x: 300,
      y: 150,
      zoom: 1.25,
    });
  });

  it("stops at the maximum zoom for small bounds", () => {
    const bounds = { height: 100, width: 100, x: 0, y: 0 };

    expect(fitGraphPersonBounds({ area, bounds, padding: 0.25, zoom: ZOOM })).toEqual({
      x: 300,
      y: 200,
      zoom: 2,
    });
  });

  it("stops at the minimum zoom for huge bounds", () => {
    const bounds = { height: 6000, width: 8000, x: 0, y: 0 };

    expect(
      fitGraphPersonBounds({
        area,
        bounds,
        padding: 0.25,
        zoom: { maxZoom: 2, minZoom: 0.25 },
      }),
    ).toEqual({ x: -600, y: -450, zoom: 0.25 });
  });

  it("centres the bounds on an area shifted by a cover", () => {
    const bounds = { height: 120, width: 320, x: 40, y: -20 };
    const coveredArea = { height: 600, width: 800, x: 64, y: 32 };

    expect(fitGraphPersonBounds({ area: coveredArea, bounds, padding: 0.25, zoom: ZOOM })).toEqual({
      x: 214,
      y: 282,
      zoom: 1.25,
    });
  });
});

describe("toGraphPersonInitialViewport", () => {
  it("returns null without boxes", () => {
    expect(
      toGraphPersonInitialViewport({
        area: SMALL_AREA,
        boxes: [],
        padding: 0.25,
        ring: null,
        zoom: ZOOM,
      }),
    ).toBeNull();
  });

  it("fits the boxes and the ring together when that fit is readable", () => {
    const boxes = [...NEAR_BOXES, { height: 24, hop: 3, width: 40, x: 152, y: 24 }];
    const ring = { center: { x: 96, y: 4 }, radius: 96 };

    expect(
      toGraphPersonInitialViewport({ area: SMALL_AREA, boxes, padding: 0.25, ring, zoom: ZOOM }),
    ).toEqual({ x: 125, y: 146.875, zoom: 0.78125 });
  });

  it("keeps the overall fit when its zoom is exactly the readable 0.65", () => {
    const boxes = [
      { height: 24, hop: 0, width: 40, x: 0, y: 0 },
      { height: 24, hop: 3, width: 40, x: 96, y: 0 },
    ];
    const narrowArea = { height: 600, width: 260, x: 0, y: 0 };

    expect(
      toGraphPersonInitialViewport({
        area: narrowArea,
        boxes,
        padding: 0.25,
        ring: null,
        zoom: ZOOM,
      })?.zoom,
    ).toBe(0.65);
  });

  it("keeps a one-step map whole even when it fits only below the readable zoom", () => {
    const boxes = [
      { height: 100, hop: 0, width: 100, x: 0, y: 0 },
      { height: 100, hop: 1, width: 100, x: 1436, y: 1448 },
    ];

    expect(
      toGraphPersonInitialViewport({
        area: SMALL_AREA,
        boxes,
        padding: 0.25,
        ring: null,
        zoom: ZOOM,
      }),
    ).toEqual({ x: 128, y: 75, zoom: 0.09375 });
  });

  it("fits only the root and its direct links when distant hops shrink the map", () => {
    const boxes = [...NEAR_BOXES, { height: 24, hop: 3, width: 40, x: 5000, y: 5000 }];

    expect(
      toGraphPersonInitialViewport({
        area: SMALL_AREA,
        boxes,
        padding: 0.25,
        ring: null,
        zoom: ZOOM,
      }),
    ).toEqual({ x: 132, y: 100, zoom: 1 });
  });

  it("leaves the ring out of the fit of the root and its direct links", () => {
    const boxes = [...NEAR_BOXES, { height: 24, hop: 2, width: 40, x: 0, y: 0 }];
    const ring = { center: { x: 20, y: 12 }, radius: 3000 };

    expect(
      toGraphPersonInitialViewport({ area: SMALL_AREA, boxes, padding: 0.25, ring, zoom: ZOOM }),
    ).toEqual({ x: 132, y: 100, zoom: 1 });
  });

  it("never zooms the fit of the root and its direct links below the readable zoom", () => {
    const boxes = [
      { height: 48, hop: 0, width: 40, x: -368, y: -50 },
      { height: 48, hop: 1, width: 40, x: 328, y: -50 },
      { height: 48, hop: 3, width: 40, x: 5000, y: 5000 },
    ];

    expect(
      toGraphPersonInitialViewport({
        area: SMALL_AREA,
        boxes,
        padding: 0.25,
        ring: null,
        zoom: ZOOM,
      }),
    ).toEqual({ x: 200, y: 150, zoom: 0.65 });
  });
});

describe("toGraphPersonRevealViewport", () => {
  const area: GraphPersonArea = { height: 600, width: 800, x: 0, y: 0 };

  it("returns null when the boxes and their plates are already on screen", () => {
    const boxes = [{ height: 100, hop: 1, width: 100, x: 100, y: 100 }];

    expect(
      toGraphPersonRevealViewport({ area, boxes, viewport: { x: 0, y: 0, zoom: 1 } }),
    ).toBeNull();
  });

  it("pans left by the overflow until the boxes touch the right edge", () => {
    const boxes = [{ height: 100, hop: 1, width: 100, x: 1500, y: 100 }];

    expect(
      toGraphPersonRevealViewport({ area, boxes, viewport: { x: 40, y: 20, zoom: 0.5 } }),
    ).toEqual({ x: -16, y: 20, zoom: 0.5 });
  });

  it("pans down by the overflow until the boxes touch the top edge", () => {
    const boxes = [{ height: 100, hop: 1, width: 100, x: 100, y: -400 }];

    expect(
      toGraphPersonRevealViewport({ area, boxes, viewport: { x: 40, y: 20, zoom: 0.5 } }),
    ).toEqual({ x: 40, y: 200, zoom: 0.5 });
  });

  it("pans up to reveal a name plate that hangs below the bottom edge", () => {
    const boxes = [{ height: 80, hop: 1, width: 100, x: 100, y: 500 }];

    expect(toGraphPersonRevealViewport({ area, boxes, viewport: { x: 0, y: 0, zoom: 1 } })).toEqual(
      { x: 0, y: -32, zoom: 1 },
    );
  });

  it("pans right until the boxes clear a cover on the left of the area", () => {
    const boxes = [{ height: 100, hop: 1, width: 100, x: 72, y: 100 }];
    const coveredArea = { height: 600, width: 736, x: 64, y: 0 };

    expect(
      toGraphPersonRevealViewport({
        area: coveredArea,
        boxes,
        viewport: { x: 0, y: 0, zoom: 1 },
      }),
    ).toEqual({ x: 24, y: 0, zoom: 1 });
  });

  it("centres boxes wider than the area on that axis without zooming out", () => {
    const boxes = [{ height: 100, hop: 1, width: 400, x: 0, y: 0 }];

    expect(
      toGraphPersonRevealViewport({ area, boxes, viewport: { x: 100, y: 0, zoom: 2 } }),
    ).toEqual({ x: 0, y: 0, zoom: 2 });
  });
});
