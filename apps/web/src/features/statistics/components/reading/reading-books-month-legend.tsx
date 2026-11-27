"use client";

import { useTranslations } from "next-intl";

import type { CalendarMonthSummary } from "../../model/statistics-calendar";

import { StatisticsNote } from "../statistics-states";
import { READING_INTENSITY_CLASS } from "./reading-intensity";

export function ReadingBooksMonthLegend({
  hasDaysBeforeAccount,
  summary,
}: {
  hasDaysBeforeAccount: boolean;
  summary: CalendarMonthSummary;
}) {
  const t = useTranslations("statistics.calendar.books");
  const tHeatmap = useTranslations("statistics.calendar.heatmap");

  const beforeAccountItem = (
    <MonthLegendItem
      label={tHeatmap("beforeAccountLegend")}
      swatch={READING_INTENSITY_CLASS.beforeAccount}
    />
  );

  if (summary.hasUnknownDays) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <MonthLegendItem
          label={tHeatmap("unknownLegend")}
          swatch={READING_INTENSITY_CLASS.unknown}
        />
        {hasDaysBeforeAccount ? beforeAccountItem : null}
      </div>
    );
  }

  if (summary.hasLegacyHistory) {
    return <StatisticsNote>{t("legacyMonthNote")}</StatisticsNote>;
  }

  return hasDaysBeforeAccount ? beforeAccountItem : null;
}

function MonthLegendItem({ label, swatch }: { label: string; swatch: string }) {
  return (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span aria-hidden className={swatch} />
      <span>{label}</span>
    </p>
  );
}
