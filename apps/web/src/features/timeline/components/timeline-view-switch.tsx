"use client";

import { useTranslations } from "next-intl";

import type { UiIconName } from "@/components/icons";

import { UiIcon } from "@/components/icons";
import { Segmented } from "@/components/ui/segmented";

import type { TimelineViewMode } from "../model/timeline-view-mode";

import { TIMELINE_VIEW_MODES, TimelineViewModeSchema } from "../model/timeline-view-mode";

const VIEW_ICON = {
  list: "list",
  overview: "chart",
  stream: "sessions",
} as const satisfies Record<TimelineViewMode, UiIconName>;

type TimelineViewSwitchProps = {
  className?: string;
  onChange: (mode: TimelineViewMode) => void;
  value: TimelineViewMode;
};

export function TimelineViewSwitch({ className, onChange, value }: TimelineViewSwitchProps) {
  const t = useTranslations("timeline");

  return (
    <Segmented
      className={className}
      label={t("viewLabel")}
      onValueChange={(next) => {
        const parsed = TimelineViewModeSchema.safeParse(next);
        if (parsed.success) onChange(parsed.data);
      }}
      options={TIMELINE_VIEW_MODES.map((mode) => ({
        icon: <UiIcon name={VIEW_ICON[mode]} size={15} />,
        label: t(`view.${mode}`),
        value: mode,
      }))}
      value={value}
    />
  );
}
