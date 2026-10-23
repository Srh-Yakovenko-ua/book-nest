"use client";

import type { Nullable, ReadingStatisticsDateRange } from "@app/shared";
import type { Ref } from "react";

import { useLocale, useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";

import { listCalendarMonths, resolveCalendarMonth } from "../../model/statistics-calendar";
import { formatMonthKey } from "../../model/statistics-format";

export function ReadingBooksMonthNav({
  displayRange,
  month,
  monthLabelRef,
  onMonthChange,
}: {
  displayRange: ReadingStatisticsDateRange;
  month: Nullable<string>;
  monthLabelRef: Ref<HTMLSpanElement>;
  onMonthChange: (month: string) => void;
}) {
  const locale = useLocale();
  const t = useTranslations("statistics.calendar.books");
  const months = listCalendarMonths(displayRange);
  const monthKey = resolveCalendarMonth({ months, requested: month });

  if (monthKey === null) return null;

  const index = months.indexOf(monthKey);

  return (
    <div className="ml-auto flex items-center gap-1">
      <Button
        aria-disabled={index <= 0}
        aria-label={t("previousMonth")}
        className="aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
        onClick={() => {
          if (index > 0) onMonthChange(months[index - 1] ?? monthKey);
        }}
        size="icon-lg"
        variant="ghost"
      >
        <UiIcon name="chevron-left" size={16} />
      </Button>
      <span
        aria-live="polite"
        className="min-w-28 text-center font-heading text-sm font-semibold text-ink outline-none"
        ref={monthLabelRef}
        tabIndex={-1}
      >
        {formatMonthKey(monthKey, locale)}
      </span>
      <Button
        aria-disabled={index >= months.length - 1}
        aria-label={t("nextMonth")}
        className="aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
        onClick={() => {
          if (index < months.length - 1) onMonthChange(months[index + 1] ?? monthKey);
        }}
        size="icon-lg"
        variant="ghost"
      >
        <UiIcon name="chevron-right" size={16} />
      </Button>
    </div>
  );
}
