"use client";

import type { Nullable, ReadingStatisticsDateRange } from "@app/shared";
import type { RefObject } from "react";

import { useLocale, useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { TooltipHint } from "@/components/tooltip-hint";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { ReadingCalendarMonth } from "../../hooks/use-reading-calendar-month";

import { ReadingBooksMonthNav } from "./reading-books-month-nav";

const MONTH_HEADER_CLASS = {
  kpi: "flex min-w-0 flex-col items-center gap-1 px-1.5 text-center",
  kpiIcon: "shrink-0 text-primary",
  kpiLabel: "order-last line-clamp-2 text-xs leading-tight text-muted-foreground",
  kpiList:
    "grid grid-cols-3 divide-x divide-border border-t border-border pt-2 @lg/month-header:flex-1 @lg/month-header:border-t-0 @lg/month-header:border-l @lg/month-header:pt-0 @lg/month-header:pl-2",
  kpiValue:
    "font-heading text-xl leading-none font-semibold whitespace-nowrap text-ink tabular-nums @2xl/month-header:text-2xl",
  kpiValueUnconfirmed: "cursor-help text-muted-foreground",
  layout: "flex flex-col gap-2 @lg/month-header:flex-row @lg/month-header:items-center",
  nav: "flex min-h-10 items-center @lg/month-header:w-2/5 @lg/month-header:shrink-0 @lg/month-header:pr-3",
  root: "@container/month-header min-h-22 justify-center gap-0 px-4 py-2.5",
} as const;

type MonthKpi = {
  icon: "book" | "calendar" | "pages";
  label: "monthActiveDays" | "monthBooks" | "monthPages";
  value: MonthKpiValue;
};

type MonthKpiValue = { kind: "known"; text: string } | { kind: "unconfirmed" };

export function ReadingBooksMonthHeader({
  displayRange,
  month,
  monthLabelRef,
  onMonthChange,
}: {
  displayRange: ReadingStatisticsDateRange;
  month: ReadingCalendarMonth;
  monthLabelRef: RefObject<Nullable<HTMLSpanElement>>;
  onMonthChange: (month: string) => void;
}) {
  const locale = useLocale();
  const t = useTranslations("statistics.calendar.books");
  const { books, summary } = month;

  const kpiValue = (isLowerBound: boolean, value: number): MonthKpiValue => {
    if (!isLowerBound) return { kind: "known", text: formatNumber(value, locale) };
    if (value === 0) return { kind: "unconfirmed" };
    return { kind: "known", text: t("atLeast", { value: formatNumber(value, locale) }) };
  };
  const kpis: MonthKpi[] = [
    {
      icon: "calendar",
      label: "monthActiveDays",
      value: kpiValue(summary.hasUnknownDays, summary.activeDays),
    },
    { icon: "book", label: "monthBooks", value: kpiValue(books.isLowerBound, books.count) },
    {
      icon: "pages",
      label: "monthPages",
      value: kpiValue(summary.hasUnknownDays, summary.pagesRead),
    },
  ];

  return (
    <Card className={MONTH_HEADER_CLASS.root}>
      <div className={MONTH_HEADER_CLASS.layout}>
        <div className={MONTH_HEADER_CLASS.nav}>
          <ReadingBooksMonthNav
            displayRange={displayRange}
            month={month.monthKey}
            monthLabelRef={monthLabelRef}
            onMonthChange={onMonthChange}
          />
        </div>
        <dl className={MONTH_HEADER_CLASS.kpiList}>
          {kpis.map((kpi) => (
            <div className={MONTH_HEADER_CLASS.kpi} key={kpi.label}>
              <dt className={MONTH_HEADER_CLASS.kpiLabel}>{t(kpi.label)}</dt>
              <dd className="flex items-center gap-1.5">
                <UiIcon
                  aria-hidden
                  className={MONTH_HEADER_CLASS.kpiIcon}
                  name={kpi.icon}
                  size={18}
                />
                {kpi.value.kind === "known" ? (
                  <span className={MONTH_HEADER_CLASS.kpiValue}>{kpi.value.text}</span>
                ) : (
                  <>
                    <TooltipHint label={t("unconfirmedValueHint")}>
                      <span
                        aria-hidden
                        className={cn(
                          MONTH_HEADER_CLASS.kpiValue,
                          MONTH_HEADER_CLASS.kpiValueUnconfirmed,
                        )}
                      >
                        {t("unconfirmedValue")}
                      </span>
                    </TooltipHint>
                    <span className="sr-only">{t("unconfirmedValueHint")}</span>
                  </>
                )}
              </dd>
            </div>
          ))}
        </dl>
      </div>
      <MonthBooksStatus monthLabelRef={monthLabelRef} status={month.monthBooksStatus} />
    </Card>
  );
}

function MonthBooksStatus({
  monthLabelRef,
  status,
}: {
  monthLabelRef: RefObject<Nullable<HTMLSpanElement>>;
  status: ReadingCalendarMonth["monthBooksStatus"];
}) {
  const t = useTranslations("statistics.calendar.books");

  const retry = async () => {
    if (status === null || status.isFetching) return;
    const result = await status.retry();
    if (result.isSuccess) monthLabelRef.current?.focus();
  };

  return (
    <div aria-live="polite">
      {status === null ? null : (
        <p
          className={cn(
            "mt-2 flex flex-wrap items-center justify-center gap-x-2 text-xs",
            status.isFetching ? "text-muted-foreground" : "text-destructive",
          )}
        >
          {status.isFetching ? t("monthBooksLoading") : t("monthBooksError")}
          {status.hasFailed ? (
            <Button
              aria-disabled={status.isFetching}
              className="underline underline-offset-2 aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
              onClick={() => void retry()}
              size="sm"
              variant="link"
            >
              {t("monthBooksRetry")}
            </Button>
          ) : null}
        </p>
      )}
    </div>
  );
}
