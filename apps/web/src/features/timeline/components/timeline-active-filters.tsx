"use client";

import type { TimelineImportance } from "@app/shared";

import { TIMELINE_EVENT_TYPES } from "@app/shared";
import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";

import type { TimelineEventsFilterState } from "../model/timeline-events-query";

import { IMPORTANCE_META } from "../model/importance-meta";

const IMPORTANCE_CHIP_ORDER = [
  "key",
  "high",
  "medium",
  "low",
] as const satisfies readonly TimelineImportance[];

type ActiveChip = {
  key: string;
  label: string;
  onRemove: () => void;
};

type TimelineActiveFiltersProps = {
  filters: TimelineEventsFilterState;
  onChange: (filters: TimelineEventsFilterState) => void;
  onClearAll: () => void;
};

export function TimelineActiveFilters({
  filters,
  onChange,
  onClearAll,
}: TimelineActiveFiltersProps) {
  const t = useTranslations("timeline.activeFilters");
  const tFilters = useTranslations("timeline.filters");
  const tTimeline = useTranslations("timeline");
  const tType = useTranslations("timeline.eventType");

  const chips: ActiveChip[] = [
    ...TIMELINE_EVENT_TYPES.filter((type) => filters.eventType.includes(type)).map((type) => ({
      key: `type:${type}`,
      label: tType(type),
      onRemove: () =>
        onChange({ ...filters, eventType: filters.eventType.filter((item) => item !== type) }),
    })),
    ...IMPORTANCE_CHIP_ORDER.filter((level) => filters.importance.includes(level)).map((level) => ({
      key: `importance:${level}`,
      label: tTimeline(IMPORTANCE_META[level].labelKey),
      onRemove: () =>
        onChange({ ...filters, importance: filters.importance.filter((item) => item !== level) }),
    })),
    ...(filters.unresolved
      ? [
          {
            key: "unresolved",
            label: tFilters("openThreads"),
            onRemove: () => onChange({ ...filters, unresolved: false }),
          },
        ]
      : []),
    ...(filters.withoutChapter
      ? [
          {
            key: "withoutChapter",
            label: tFilters("withoutChapter"),
            onRemove: () => onChange({ ...filters, withoutChapter: false }),
          },
        ]
      : []),
  ];

  if (chips.length === 0) return null;

  return (
    <div aria-label={t("label")} className="flex flex-wrap items-center gap-2" role="group">
      {chips.map((chip) => (
        <span
          className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-tag py-0.5 pr-0.5 pl-3 text-sm font-medium text-tag-foreground"
          key={chip.key}
        >
          <span className="truncate">{chip.label}</span>
          <button
            aria-label={t("remove", { label: chip.label })}
            className="grid size-6 shrink-0 cursor-pointer place-items-center rounded-full border border-transparent text-tag-foreground opacity-60 transition-[opacity,background-color] hover:bg-ink/10 hover:opacity-100 focus-visible:border-ring focus-visible:opacity-100 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            onClick={chip.onRemove}
            type="button"
          >
            <UiIcon className="size-3" name="x" size={12} />
          </button>
        </span>
      ))}
      <button
        className="cursor-pointer rounded-sm border border-transparent px-1 py-0.5 text-sm font-semibold text-error outline-none hover:underline focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        onClick={onClearAll}
        type="button"
      >
        {t("clearAll")}
      </button>
    </div>
  );
}
