import { TIMELINE_COLOR_KEYS } from "@app/shared";
import { describe, expect, it } from "vitest";

import { PALETTE_COLOR_STYLES } from "@/components/ui/palette-color";

import { markerStyle } from "./color-key";

describe("markerStyle", () => {
  it("covers exactly the canonical palette keys", () => {
    expect(Object.keys(PALETTE_COLOR_STYLES).sort()).toEqual([...TIMELINE_COLOR_KEYS].sort());
  });

  it("paints the marker with the contrast tone of its palette color", () => {
    for (const colorKey of TIMELINE_COLOR_KEYS) {
      expect(markerStyle(colorKey)).toEqual({
        backgroundColor: PALETTE_COLOR_STYLES[colorKey].marker,
      });
    }
  });

  it("uses the shared tag foreground variables as the marker tone", () => {
    expect(markerStyle("sky")).toEqual({ backgroundColor: "var(--tag-sky-foreground)" });
    expect(markerStyle("terracotta")).toEqual({
      backgroundColor: "var(--tag-terracotta-foreground)",
    });
  });
});
