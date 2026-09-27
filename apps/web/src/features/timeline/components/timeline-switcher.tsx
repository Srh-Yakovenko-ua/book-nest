"use client";

import type { Nullable, TimelineView } from "@app/shared";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { ChipGroup } from "@/components/ui/chip-group";

import { markerStyle } from "../model/color-key";

const ALL_LINES_VALUE = "all";

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
  const orderedLines = [...timelines].sort((first, second) => first.position - second.position);

  const options = [
    { label: t("allLines", { count: totalEvents }), value: ALL_LINES_VALUE },
    ...orderedLines.map((line) => ({
      count: line.eventsCount,
      icon: <span aria-hidden className="size-2 rounded-full" style={markerStyle(line.colorKey)} />,
      label: line.name,
      value: line.id,
    })),
  ];

  return (
    <div className="flex min-w-0 items-center gap-2">
      <ChipGroup
        className="min-w-0 flex-1 flex-nowrap overflow-x-auto pb-1 md:flex-wrap md:pb-0"
        label={t("linesLabel")}
        mode="single"
        onValueChange={(value) => onSelect(value === ALL_LINES_VALUE ? null : value)}
        options={options}
        size="sm"
        value={activeTimelineId ?? ALL_LINES_VALUE}
      />
      <Button className="shrink-0" onClick={onManageLines} size="sm" variant="ghost">
        <UiIcon name="layers" size={16} />
        {t("manageLines")}
      </Button>
    </div>
  );
}
