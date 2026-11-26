"use client";

import { useTranslations } from "next-intl";

import type { CalendarMonthSummary } from "../../model/statistics-calendar";

import { StatisticsNote } from "../statistics-states";
import { READING_INTENSITY_CLASS } from "./reading-intensity";

export function ReadingBooksMonthLegend({ summary }: { summary: CalendarMonthSummary }) {
  const t = useTranslations("statistics.calendar.books");
  const tHeatmap = useTranslations("statistics.calendar.heatmap");

  if (summary.hasUnknownDays) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span aria-hidden className={READING_INTENSITY_CLASS.unknown} />
        <span>{tHeatmap("unknownLegend")}</span>
      </p>
    );
  }

  if (summary.hasLegacyHistory) {
    return <StatisticsNote>{t("legacyMonthNote")}</StatisticsNote>;
  }

  return null;
}
