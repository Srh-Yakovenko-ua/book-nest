"use client";

import type { TimelineColorKey } from "@app/shared";

import { chipVariants } from "@/components/ui/chip-group";
import { cn } from "@/lib/utils";

import { lineChipStyle, markerStyle } from "../model/color-key";

const LINE_CHIP_SIZES = {
  compact:
    "inline-flex max-w-full items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
  control: chipVariants({ size: "sm" }),
} as const;

type TimelineLineChipProps = {
  className?: string;
  colorKey: TimelineColorKey;
  count?: number;
  name: string;
  selected?: boolean;
  size?: keyof typeof LINE_CHIP_SIZES;
  withMarker?: boolean;
};

export function TimelineLineChip({
  className,
  colorKey,
  count,
  name,
  selected = false,
  size = "control",
  withMarker = true,
}: TimelineLineChipProps) {
  return (
    <span
      className={cn(
        LINE_CHIP_SIZES[size],
        selected && "inset-ring-2 inset-ring-current/45",
        className,
      )}
      data-slot="chip"
      style={lineChipStyle(colorKey)}
    >
      {withMarker ? (
        <span aria-hidden className="size-2 shrink-0 rounded-full" style={markerStyle(colorKey)} />
      ) : null}
      <span className="min-w-0 truncate">{name}</span>
      {count === undefined ? null : (
        <span className="min-w-[2ch] text-center tabular-nums opacity-70">{count}</span>
      )}
    </span>
  );
}
