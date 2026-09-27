import type { TimelineColorKey } from "@app/shared";
import type { CSSProperties } from "react";

import { PALETTE_COLOR_STYLES } from "@/components/ui/palette-color";

export function markerStyle(colorKey: TimelineColorKey): CSSProperties {
  return { backgroundColor: PALETTE_COLOR_STYLES[colorKey].marker };
}
