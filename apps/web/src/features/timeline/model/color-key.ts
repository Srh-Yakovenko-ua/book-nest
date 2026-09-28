import type { TimelineColorKey } from "@app/shared";
import type { CSSProperties } from "react";

import { PALETTE_COLOR_STYLES } from "@/components/ui/palette-color";

const LINE_CHIP_TONES = {
  borderStrength: "45%",
} as const;

export function lineChipStyle(colorKey: TimelineColorKey): CSSProperties {
  const palette = PALETTE_COLOR_STYLES[colorKey];
  return {
    backgroundColor: palette.bg,
    borderColor: `color-mix(in oklab, ${palette.text} ${LINE_CHIP_TONES.borderStrength}, transparent)`,
    color: palette.text,
  };
}

export function markerStyle(colorKey: TimelineColorKey): CSSProperties {
  return { backgroundColor: PALETTE_COLOR_STYLES[colorKey].marker };
}
