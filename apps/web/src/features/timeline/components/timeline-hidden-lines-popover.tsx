"use client";

import type { Nullable, TimelineView } from "@app/shared";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { chipVariants } from "@/components/ui/chip-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import { markerStyle } from "../model/color-key";

type TimelineHiddenLinesPopoverProps = {
  activeTimelineId: Nullable<string>;
  carriesSelection: boolean;
  className?: string;
  lines: TimelineView[];
  onSelect: (timelineId: string) => void;
};

export function TimelineHiddenLinesPopover({
  activeTimelineId,
  carriesSelection,
  className,
  lines,
  onSelect,
}: TimelineHiddenLinesPopoverProps) {
  const t = useTranslations("timeline");
  const [open, setOpen] = useState(false);

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger
        className={cn(
          chipVariants({ size: "sm" }),
          carriesSelection && "inset-ring-2 inset-ring-accent-border",
          className,
        )}
      >
        {t("moreLines", { count: lines.length })}
      </PopoverTrigger>
      <PopoverContent
        align="end"
        aria-label={t("otherLines")}
        className="no-scrollbar max-h-72 gap-0.5 overflow-y-auto p-1.5"
      >
        {lines.map((line) => (
          <button
            aria-current={line.id === activeTimelineId ? "true" : undefined}
            className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left outline-none hover:bg-secondary focus-visible:bg-secondary aria-[current=true]:bg-accent aria-[current=true]:text-accent-foreground"
            key={line.id}
            onClick={() => {
              onSelect(line.id);
              setOpen(false);
            }}
            type="button"
          >
            <span
              aria-hidden
              className="size-2 shrink-0 rounded-full"
              style={markerStyle(line.colorKey)}
            />
            <span className="min-w-0 flex-1 truncate">{line.name}</span>
            <span className="shrink-0 text-muted-foreground tabular-nums">{line.eventsCount}</span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
