"use client";

import { useLocale, useTranslations } from "next-intl";

import { formatDate } from "@/lib/format";

type ReadingDaySummaryRowProps = {
  date: string;
  finalPage: null | number;
  pagesRead: number;
  updatesCount: number;
};

export function ReadingDaySummaryRow({
  date,
  finalPage,
  pagesRead,
  updatesCount,
}: ReadingDaySummaryRowProps) {
  const t = useTranslations("books.details.reading");
  const locale = useLocale();

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
      <span className="text-sm font-medium text-foreground tabular-nums">
        {formatDate(date, locale)}
      </span>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-xs tabular-nums">
        <span className="font-semibold text-primary">{t("pagesDelta", { count: pagesRead })}</span>
        <span className="text-muted-foreground">{t("updatesCount", { count: updatesCount })}</span>
        {finalPage === null ? null : (
          <span className="text-muted-foreground">{t("toPage", { page: finalPage })}</span>
        )}
      </div>
    </div>
  );
}
