"use client";

import type { Nullable, TimelineView } from "@app/shared";

import { useTranslations } from "next-intl";
import { ToggleGroup as ToggleGroupPrimitive } from "radix-ui";
import { useId, useLayoutEffect, useRef, useState } from "react";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { chipVariants } from "@/components/ui/chip-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { TimelineHiddenLinesPopover } from "./timeline-hidden-lines-popover";
import { TimelineLineChip } from "./timeline-line-chip";

const LINE_CHIPS = {
  allValue: "all",
  gapPx: 8,
  maxRows: 2,
  maxWidth: "max-w-[208px]",
  maxWidthPx: 208,
} as const;

type ChipMeasurement = {
  availableWidth: number;
  naturalWidths: ReadonlyMap<string, number>;
};

type TimelineSwitcherProps = {
  activeTimelineId: Nullable<string>;
  onManageLines: () => void;
  onSelect: (timelineId: Nullable<string>) => void;
  timelines: TimelineView[];
  totalEvents: number;
};

export function TimelineSwitcher({
  activeTimelineId,
  onManageLines,
  onSelect,
  timelines,
  totalEvents,
}: TimelineSwitcherProps) {
  const t = useTranslations("timeline");
  const labelId = useId();
  const sizerRef = useRef<Nullable<HTMLDivElement>>(null);
  const [measurement, setMeasurement] = useState<ChipMeasurement>(() => ({
    availableWidth: 0,
    naturalWidths: new Map(),
  }));

  const orderedLines = [...timelines].sort((first, second) => first.position - second.position);
  const measurementKey = orderedLines
    .map((line) => `${line.id}:${line.name}:${line.eventsCount}`)
    .join("|");

  useLayoutEffect(() => {
    const sizer = sizerRef.current;
    if (sizer === null) return;

    const measure = () => setMeasurement(readChipMeasurement(sizer));

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(sizer);

    return () => observer.disconnect();
  }, [measurementKey]);

  const positionHiddenLines = planHiddenLines(orderedLines, measurement);
  const promotedLineId = positionHiddenLines.some((line) => line.id === activeTimelineId)
    ? activeTimelineId
    : null;
  const hiddenLines =
    promotedLineId === null
      ? positionHiddenLines
      : planHiddenLines(withLineFirst(orderedLines, promotedLineId), measurement);
  const hiddenLineIds = new Set(hiddenLines.map((line) => line.id));

  function renderLineChip(line: TimelineView) {
    const chip = (
      <ToggleGroupPrimitive.Item
        className={cn(
          "inline-flex shrink-0 cursor-pointer rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
          LINE_CHIPS.maxWidth,
          hiddenLineIds.has(line.id) && "sm:hidden",
          line.id === promotedLineId && "sm:order-first",
        )}
        key={line.id}
        value={line.id}
      >
        <TimelineLineChip
          className="min-w-0 hover:brightness-95 dark:hover:brightness-110 [&>span:last-child]:shrink-0"
          colorKey={line.colorKey}
          count={line.eventsCount}
          name={line.name}
          selected={line.id === activeTimelineId}
        />
      </ToggleGroupPrimitive.Item>
    );

    const naturalWidth = measurement.naturalWidths.get(line.id) ?? 0;
    if (naturalWidth <= LINE_CHIPS.maxWidthPx) return chip;

    return (
      <Tooltip key={line.id}>
        <TooltipTrigger asChild>{chip}</TooltipTrigger>
        <TooltipContent>{line.name}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-secondary/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold tracking-wide text-ink uppercase" id={labelId}>
          {t("lines")}
        </span>
        <Button onClick={onManageLines} size="sm" variant="tonal">
          <UiIcon name="layers" size={16} />
          {t("manageLines")}
        </Button>
      </div>

      <div className="flex items-end gap-2">
        <div className="relative min-w-0 flex-1">
          <div
            aria-hidden
            className="pointer-events-none invisible absolute inset-x-0 top-0 flex flex-wrap gap-2"
            ref={sizerRef}
          >
            <span
              className={cn(chipVariants({ size: "sm" }), "shrink-0")}
              data-chip-id={LINE_CHIPS.allValue}
            >
              {t("allLines")}
              <span className="min-w-[2ch] text-center tabular-nums">{totalEvents}</span>
            </span>
            {orderedLines.map((line) => (
              <span className="inline-flex shrink-0" data-chip-id={line.id} key={line.id}>
                <TimelineLineChip
                  colorKey={line.colorKey}
                  count={line.eventsCount}
                  name={line.name}
                />
              </span>
            ))}
          </div>

          <ToggleGroupPrimitive.Root
            aria-labelledby={labelId}
            className="-m-1 no-scrollbar flex min-w-0 flex-nowrap gap-2 overflow-x-auto p-1 sm:flex-wrap sm:overflow-x-visible"
            data-slot="chip-group"
            onValueChange={(next) => {
              if (next) onSelect(next === LINE_CHIPS.allValue ? null : next);
            }}
            type="single"
            value={activeTimelineId ?? LINE_CHIPS.allValue}
          >
            <ToggleGroupPrimitive.Item
              className={cn(
                chipVariants({ size: "sm" }),
                "shrink-0 data-[state=on]:border-accent-border data-[state=on]:bg-accent data-[state=on]:text-accent-foreground sm:order-first",
              )}
              data-slot="chip"
              value={LINE_CHIPS.allValue}
            >
              {t("allLines")}
              <span className="min-w-[2ch] text-center text-muted-foreground tabular-nums group-data-[state=on]/chip:text-accent-foreground">
                {totalEvents}
              </span>
            </ToggleGroupPrimitive.Item>
            {orderedLines.map((line) => renderLineChip(line))}
          </ToggleGroupPrimitive.Root>
        </div>

        {hiddenLines.length > 0 ? (
          <TimelineHiddenLinesPopover
            activeTimelineId={activeTimelineId}
            carriesSelection={activeTimelineId !== null && hiddenLineIds.has(activeTimelineId)}
            className="hidden sm:inline-flex"
            lines={hiddenLines}
            onSelect={onSelect}
          />
        ) : null}
      </div>
    </div>
  );
}

function planHiddenLines(
  lines: TimelineView[],
  { availableWidth, naturalWidths }: ChipMeasurement,
): TimelineView[] {
  const leadingWidth = naturalWidths.get(LINE_CHIPS.allValue);
  if (leadingWidth === undefined || availableWidth <= 0) return [];

  let rowsUsed = 1;
  let rowWidth = leadingWidth;

  for (const [index, line] of lines.entries()) {
    const chipWidth = Math.min(naturalWidths.get(line.id) ?? 0, LINE_CHIPS.maxWidthPx);
    const extendedRowWidth = rowWidth + LINE_CHIPS.gapPx + chipWidth;

    if (extendedRowWidth <= availableWidth) {
      rowWidth = extendedRowWidth;
      continue;
    }
    if (rowsUsed === LINE_CHIPS.maxRows) return lines.slice(index);

    rowsUsed += 1;
    rowWidth = chipWidth;
  }

  return [];
}

function readChipMeasurement(sizer: HTMLElement): ChipMeasurement {
  const naturalWidths = new Map<string, number>();

  for (const chip of sizer.querySelectorAll<HTMLElement>("[data-chip-id]")) {
    const chipId = chip.dataset.chipId;
    if (chipId !== undefined) naturalWidths.set(chipId, chip.offsetWidth);
  }

  return { availableWidth: sizer.clientWidth, naturalWidths };
}

function withLineFirst(lines: TimelineView[], lineId: string): TimelineView[] {
  const promoted = lines.find((line) => line.id === lineId);
  if (promoted === undefined) return lines;
  return [promoted, ...lines.filter((line) => line.id !== lineId)];
}
