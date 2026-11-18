"use client";

import type { Nullable } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";
import { useId } from "react";

import { cn } from "@/lib/utils";

import type { SelectableCalendarDay } from "../../model/statistics-calendar";

import { formatDayLong } from "../../model/statistics-format";
import { ReadingDayDetails } from "../details/reading-day-details";
import { StatisticsSectionState } from "../statistics-states";

export function ReadingBooksDayPanel({
  className,
  id,
  isHistoryUncertain,
  selected,
}: {
  className?: string;
  id: string;
  isHistoryUncertain: boolean;
  selected: Nullable<SelectableCalendarDay>;
}) {
  const locale = useLocale();
  const t = useTranslations("statistics.calendar.books");
  const headingId = useId();

  if (selected === null) {
    return (
      <div className={className} id={id}>
        {isHistoryUncertain ? (
          <StatisticsSectionState
            description={t("emptyMonthUncertainDescription")}
            kind="empty"
            title={t("emptyMonthUncertainTitle")}
          />
        ) : (
          <StatisticsSectionState kind="empty" title={t("emptyMonth")} />
        )}
      </div>
    );
  }

  return (
    <div className={cn("lg:relative", className)}>
      <div
        aria-labelledby={headingId}
        className="flex max-h-96 flex-col gap-2 overflow-y-auto rounded-xl bg-muted/50 p-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 lg:absolute lg:inset-x-0 lg:top-0 lg:max-h-full"
        id={id}
        role="region"
        tabIndex={0}
      >
        <h3 className="font-heading text-base font-semibold text-ink" id={headingId}>
          {formatDayLong(selected.date, locale)}
        </h3>
        <ReadingDayDetails date={selected.detailDate} variant="panel" />
      </div>
    </div>
  );
}
