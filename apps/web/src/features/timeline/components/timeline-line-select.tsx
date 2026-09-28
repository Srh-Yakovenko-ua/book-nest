"use client";

import type { Nullable, TimelineView } from "@app/shared";

import { useTranslations } from "next-intl";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { markerStyle } from "../model/color-key";

const ALL_LINES_VALUE = "all";

type TimelineLineSelectProps = {
  activeTimelineId: Nullable<string>;
  onSelect: (timelineId: Nullable<string>) => void;
  timelines: TimelineView[];
  totalEvents: number;
};

export function TimelineLineSelect({
  activeTimelineId,
  onSelect,
  timelines,
  totalEvents,
}: TimelineLineSelectProps) {
  const t = useTranslations("timeline");
  const orderedLines = [...timelines].sort((first, second) => first.position - second.position);

  return (
    <Select
      onValueChange={(next) => onSelect(next === ALL_LINES_VALUE ? null : next)}
      value={activeTimelineId ?? ALL_LINES_VALUE}
    >
      <SelectTrigger
        aria-label={t("lines")}
        className="w-full data-[size=default]:h-10 *:data-[slot=select-value]:*:line-clamp-1 sm:w-48 sm:shrink-0"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-72 max-w-xs">
        <SelectItem value={ALL_LINES_VALUE}>
          <span className="line-clamp-2 min-w-0">{t("allLines")}</span>
          <span className="shrink-0 text-muted-foreground tabular-nums">{totalEvents}</span>
        </SelectItem>
        {orderedLines.map((line) => (
          <SelectItem key={line.id} value={line.id}>
            <span
              aria-hidden
              className="size-2 shrink-0 rounded-full"
              style={markerStyle(line.colorKey)}
            />
            <span className="line-clamp-2 min-w-0">{line.name}</span>
            <span className="shrink-0 text-muted-foreground tabular-nums">{line.eventsCount}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
