import { TIMELINE_COLOR_KEYS } from "@app/shared";
import { describe, expect, it } from "vitest";

import { markerClass, TIMELINE_MARKER_CLASS } from "./color-key";

describe("markerClass", () => {
  it("maps each color key to its dedicated marker class", () => {
    for (const colorKey of TIMELINE_COLOR_KEYS) {
      expect(markerClass(colorKey)).toBe(TIMELINE_MARKER_CLASS[colorKey]);
    }
  });

  it("uses a recognizable tone for named colors", () => {
    expect(markerClass("blue")).toBe("bg-blue-500");
    expect(markerClass("red")).toBe("bg-red-500");
  });

  it("falls back to a neutral tone when no color is assigned", () => {
    expect(markerClass(null)).toBe("bg-muted-foreground/40");
  });
});
