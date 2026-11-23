import { describe, expect, it } from "vitest";

import { CANVAS_FIT, toCanvasFitHeight } from "./graph-canvas-fit";

describe("toCanvasFitHeight", () => {
  it("fills the first screen under the toolbar, keeping a bottom gap on the page", () => {
    expect(
      toCanvasFitHeight({
        contained: false,
        offsetTop: 266,
        paddingBottom: 0,
        viewportHeight: 936,
      }),
    ).toBe(936 - 266 - CANVAS_FIT.bottomGap);
  });

  it("uses the scroll container padding instead of the page gap in full screen", () => {
    expect(
      toCanvasFitHeight({ contained: true, offsetTop: 60, paddingBottom: 12, viewportHeight: 256 }),
    ).toBe(184);
  });

  it("keeps a usable minimum when the toolbar leaves no room on the page", () => {
    expect(
      toCanvasFitHeight({
        contained: false,
        offsetTop: 444,
        paddingBottom: 0,
        viewportHeight: 312,
      }),
    ).toBe(CANVAS_FIT.min.page);
  });

  it("allows a smaller minimum inside the full screen container", () => {
    expect(
      toCanvasFitHeight({
        contained: true,
        offsetTop: 200,
        paddingBottom: 12,
        viewportHeight: 256,
      }),
    ).toBe(CANVAS_FIT.min.contained);
  });

  it("stops growing on very tall screens", () => {
    expect(
      toCanvasFitHeight({
        contained: false,
        offsetTop: 200,
        paddingBottom: 0,
        viewportHeight: 2400,
      }),
    ).toBe(CANVAS_FIT.max);
  });
});
