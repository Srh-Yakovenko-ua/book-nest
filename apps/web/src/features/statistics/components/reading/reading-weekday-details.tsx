"use client";

import type { StatisticsWeekdayActivityItem } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";

import { StatCard } from "@/components/ui/stat-card";
import { formatNumber } from "@/lib/format";

import { weekdayLabel } from "../../model/statistics-format";
import { StatisticsNote } from "../statistics-states";

const WEEKDAY_DETAILS = {
  card: "px-2.5 py-2.5 sm:px-2.5 sm:py-2.5",
  cards: "grid w-full grid-cols-2 gap-2",
  label: "text-xs font-medium text-muted-foreground",
  name: "font-heading text-2xl font-semibold text-ink capitalize",
  root: "flex flex-col items-start justify-start gap-3",
  summary: "text-sm text-muted-foreground",
} as const;

const WEEKDAY_MESSAGE_KEY: Record<number, string> = {
  0: "sun",
  1: "mon",
  2: "tue",
  3: "wed",
  4: "thu",
  5: "fri",
  6: "sat",
};

export function ReadingWeekdayDetails({
  isLowerBound,
  row,
}: {
  isLowerBound: boolean;
  row: StatisticsWeekdayActivityItem;
}) {
  const locale = useLocale();
  const t = useTranslations("statistics.habits.weekdays.panel");
  const tSummary = useTranslations("statistics.calendar.summary");
  const lowerBound = (value: string) =>
    isLowerBound ? tSummary("lowerBoundValue", { value }) : value;

  return (
    <div className={WEEKDAY_DETAILS.root}>
      <div className="flex flex-col gap-0.5">
        <p className={WEEKDAY_DETAILS.label}>{t("label")}</p>
        <p className={WEEKDAY_DETAILS.name}>{weekdayLabel({ locale, weekday: row.weekday })}</p>
      </div>

      <div className={WEEKDAY_DETAILS.cards}>
        <StatCard
          className={WEEKDAY_DETAILS.card}
          icon="calendar"
          iconBadgeSize="md"
          iconTone="primary"
          label={t("days")}
          labelOverflow="wrap"
          size="compact"
          value={lowerBound(String(row.activeDays))}
        />
        <StatCard
          className={WEEKDAY_DETAILS.card}
          icon="book-open-text"
          iconBadgeSize="md"
          iconTone="info"
          label={t("pages")}
          labelOverflow="wrap"
          size="compact"
          value={lowerBound(formatNumber(row.pagesRead, locale))}
        />
      </div>

      <p aria-live="polite" className={WEEKDAY_DETAILS.summary}>
        {t("summary", {
          days: row.activeDays,
          weekday: WEEKDAY_MESSAGE_KEY[row.weekday] ?? "sun",
        })}
      </p>

      <StatisticsNote>{t("note")}</StatisticsNote>
    </div>
  );
}
