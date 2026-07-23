"use client";

import type { TimelineEventSort } from "@app/shared";

import { useTranslations } from "next-intl";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { sortOptionsForMode } from "../model/timeline-events-query";

const SORT_LABEL_KEY = {
  book_order: "bookOrder",
  importance: "importance",
  newest: "newest",
  oldest: "oldest",
  timeline_order: "timelineOrder",
} as const satisfies Record<TimelineEventSort, string>;

type TimelineSortProps = {
  isAllLines: boolean;
  onChange: (sort: TimelineEventSort) => void;
  value: TimelineEventSort;
};

export function TimelineSort({ isAllLines, onChange, value }: TimelineSortProps) {
  const t = useTranslations("timeline.sort");
  const options = sortOptionsForMode(isAllLines);

  return (
    <Select
      onValueChange={(next) => {
        const match = options.find((option) => option === next);
        if (match !== undefined) onChange(match);
      }}
      value={value}
    >
      <SelectTrigger aria-label={t("label")} className="w-full data-[size=default]:h-10 sm:w-56">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option} value={option}>
            {t(SORT_LABEL_KEY[option])}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
