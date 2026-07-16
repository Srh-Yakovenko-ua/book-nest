"use client";

import type { ReadingHistoryDayView } from "@app/shared";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";

import { ReadingDaySummaryRow } from "../reading/reading-day-summary-row";

type RecentReadingActivityProps = {
  days: ReadingHistoryDayView[];
  onViewFullHistory: () => void;
};

export function RecentReadingActivity({ days, onViewFullHistory }: RecentReadingActivityProps) {
  const t = useTranslations("books.details.reading");

  if (days.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-foreground">{t("recentActivity")}</h3>
      <ul className="flex flex-col gap-1.5">
        {days.map((day) => (
          <li
            className="rounded-lg border border-border/60 bg-secondary/20 px-3 py-2.5"
            key={day.date}
          >
            <ReadingDaySummaryRow
              date={day.date}
              finalPage={day.finalPage}
              pagesRead={day.pagesRead}
              updatesCount={day.updatesCount}
            />
          </li>
        ))}
      </ul>
      <Button className="self-start" onClick={onViewFullHistory} size="sm" variant="ghost">
        {t("viewFullHistory")}
        <UiIcon name="arrow-right" size={16} />
      </Button>
    </section>
  );
}
