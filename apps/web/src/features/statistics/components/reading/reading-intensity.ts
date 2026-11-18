export const READING_INTENSITY_CLASS = {
  background: ["bg-secondary", "bg-primary/25", "bg-primary/45", "bg-primary/65", "bg-primary"],
  meter: {
    fill: "h-full rounded-full bg-primary",
    fillWidth: ["w-0", "w-1", "w-2", "w-3", "w-4"],
    track: "flex h-1 w-4 shrink-0 overflow-hidden rounded-full bg-border",
  },
  unknown: "size-3 shrink-0 rounded-xs hatched",
} as const;
