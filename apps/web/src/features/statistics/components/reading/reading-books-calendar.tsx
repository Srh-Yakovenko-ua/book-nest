"use client";

import type { Nullable, WeekStartDay } from "@app/shared";

import { useTranslations } from "next-intl";

import type { BooksCalendarJumpTarget } from "../../hooks/use-books-calendar-jump";
import type { ReadingCalendarMonth } from "../../hooks/use-reading-calendar-month";

import { StatisticsSectionState } from "../statistics-states";
import { ReadingBooksDiary } from "./reading-books-diary";
import { ReadingBooksMonthGrid } from "./reading-books-month-grid";

export function ReadingBooksCalendar({
  isMobile,
  jumpTarget,
  month,
  onSelectDay,
  panelId,
  today,
  weekStartDay,
}: {
  isMobile: Nullable<boolean>;
  jumpTarget?: Nullable<BooksCalendarJumpTarget>;
  month: ReadingCalendarMonth;
  onSelectDay: (date: string) => void;
  panelId: string;
  today: string;
  weekStartDay: WeekStartDay;
}) {
  const t = useTranslations("statistics.calendar.books");
  const { monthKey } = month;

  if (monthKey === null) {
    return <StatisticsSectionState kind="empty" title={t("empty")} />;
  }

  if (isMobile === null) return null;

  if (isMobile) {
    return (
      <ReadingBooksDiary
        days={month.days}
        isHistoryUncertain={month.isHistoryUncertain}
        jumpTarget={jumpTarget}
      />
    );
  }

  return (
    <ReadingBooksMonthGrid
      accountStart={month.accountStart}
      days={month.days}
      jumpTarget={jumpTarget}
      monthKey={monthKey}
      onSelectDay={onSelectDay}
      panelId={panelId}
      selectedDate={month.selected?.date ?? null}
      today={today}
      weekStartDay={weekStartDay}
    />
  );
}
