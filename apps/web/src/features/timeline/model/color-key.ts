import type { Nullable, TimelineColorKey } from "@app/shared";

const NEUTRAL_MARKER_CLASS = "bg-muted-foreground/40";

export const TIMELINE_MARKER_CLASS = {
  amber: "bg-amber-500",
  blue: "bg-blue-500",
  emerald: "bg-emerald-500",
  fuchsia: "bg-fuchsia-500",
  orange: "bg-orange-500",
  red: "bg-red-500",
  rose: "bg-rose-500",
  sky: "bg-sky-500",
  slate: "bg-slate-400",
  stone: "bg-stone-400",
  teal: "bg-teal-500",
  violet: "bg-violet-500",
} as const satisfies Record<TimelineColorKey, string>;

export function markerClass(colorKey: Nullable<TimelineColorKey>): string {
  return colorKey === null ? NEUTRAL_MARKER_CLASS : TIMELINE_MARKER_CLASS[colorKey];
}
