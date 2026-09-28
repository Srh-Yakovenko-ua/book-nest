"use client";

import { useTranslations } from "next-intl";

import type { UiIconName } from "@/components/icons";

import { UiIcon } from "@/components/icons";
import { Segmented } from "@/components/ui/segmented";

import type { TimelineEventViewMode } from "../model/timeline-view-mode";

import {
  TIMELINE_EVENT_VIEW_MODES,
  TimelineEventViewModeSchema,
} from "../model/timeline-view-mode";

const VIEW_ICON = {
  list: "table",
  stream: "timeline",
} as const satisfies Record<TimelineEventViewMode, UiIconName>;

type TimelineViewSwitchProps = {
  className?: string;
  onChange: (mode: TimelineEventViewMode) => void;
  value: TimelineEventViewMode;
};

export function TimelineViewSwitch({ className, onChange, value }: TimelineViewSwitchProps) {
  const t = useTranslations("timeline");

  return (
    <Segmented
      className={className}
      label={t("viewLabel")}
      onValueChange={(next) => {
        const parsed = TimelineEventViewModeSchema.safeParse(next);
        if (parsed.success) onChange(parsed.data);
      }}
      options={TIMELINE_EVENT_VIEW_MODES.map((mode) => ({
        icon: <UiIcon name={VIEW_ICON[mode]} size={15} />,
        label: t(`view.${mode}`),
        value: mode,
      }))}
      tone="accent"
      value={value}
    />
  );
}
