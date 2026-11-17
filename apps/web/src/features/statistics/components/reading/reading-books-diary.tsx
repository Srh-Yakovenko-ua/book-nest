"use client";

import type { Nullable, StatisticsCalendarDay } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";

import { formatNumber } from "@/lib/format";

import type { BooksCalendarJumpTarget } from "../../hooks/use-books-calendar-jump";

import { resolveReadingDayTarget } from "../../model/statistics-drilldown";
import { formatDayLong } from "../../model/statistics-format";
import { ReadingDayDetails } from "../details/reading-day-details";
import { StatisticsDetailSurface } from "../details/statistics-detail-surface";
import { StatisticsNote, StatisticsSectionState } from "../statistics-states";
import { ReadingDayPreview } from "./reading-day-preview";

export function ReadingBooksDiary({
  days,
  isHistoryUncertain,
  jumpTarget,
}: {
  days: readonly StatisticsCalendarDay[];
  isHistoryUncertain: boolean;
  jumpTarget?: Nullable<BooksCalendarJumpTarget>;
}) {
  const locale = useLocale();
  const t = useTranslations("statistics.calendar.books");
  const activeDays = days.filter((day) => day.booksCount > 0).reverse();

  if (activeDays.length === 0) {
    return isHistoryUncertain ? (
      <StatisticsSectionState
        description={t("emptyMonthUncertainDescription")}
        kind="empty"
        title={t("emptyMonthUncertainTitle")}
      />
    ) : (
      <StatisticsSectionState kind="empty" title={t("emptyMonth")} />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {activeDays.map((day) => (
          <li key={day.date}>
            <DiaryRow
              date={formatDayLong(day.date, locale)}
              day={day}
              jumpTarget={jumpTarget?.date === day.date ? jumpTarget : null}
              locale={locale}
            />
          </li>
        ))}
      </ul>
      {isHistoryUncertain ? <StatisticsNote>{t("legacyMonthNote")}</StatisticsNote> : null}
    </div>
  );
}

function DiaryRow({
  date,
  day,
  jumpTarget,
  locale,
}: {
  date: string;
  day: StatisticsCalendarDay;
  jumpTarget: Nullable<BooksCalendarJumpTarget>;
  locale: string;
}) {
  const t = useTranslations("statistics.calendar.books");
  const detailDate = resolveReadingDayTarget(day.drilldown);

  const body = (
    <>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-sm font-medium text-foreground">{date}</span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {t("diaryMeta", { books: day.booksCount, pages: formatNumber(day.pagesRead, locale) })}
        </span>
      </span>
      <ReadingDayPreview className="shrink-0" day={day} />
    </>
  );

  if (detailDate === null) {
    return (
      <span className="flex w-full items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5">
        {body}
      </span>
    );
  }

  return (
    <StatisticsDetailSurface
      detail={() => <ReadingDayDetails date={detailDate} />}
      label={t("daySummary", { books: day.booksCount, date, pages: day.pagesRead })}
      title={date}
      triggerClassName="flex w-full scroll-mt-4 items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 data-jump-highlight:ring-2 data-jump-highlight:ring-primary"
      triggerRef={jumpTarget?.ref}
    >
      {body}
    </StatisticsDetailSurface>
  );
}
