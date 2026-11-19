"use client";

import type { Nullable } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";
import { useId } from "react";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

import type { SelectableCalendarDay } from "../../model/statistics-calendar";

import { formatDayLong } from "../../model/statistics-format";
import { ReadingDayDetails } from "../details/reading-day-details";

const DAY_PANEL_CLASS = {
  empty: {
    icon: "mt-0.5 shrink-0 text-muted-foreground",
    message: "flex items-start gap-2.5 rounded-lg bg-muted/50 px-3 py-2.5",
    note: "text-xs text-muted-foreground",
    text: "text-sm font-medium text-foreground",
    title: "font-heading text-base leading-tight font-semibold text-ink",
  },
  eyebrow: "text-xs font-medium text-muted-foreground",
  root: "gap-3 px-4 py-4",
  step: "aria-disabled:cursor-not-allowed aria-disabled:opacity-50",
  title: "font-heading text-lg leading-tight font-semibold text-ink",
} as const;

export function ReadingBooksDayPanel({
  id,
  isHistoryUncertain,
  onSelectDay,
  selectableDays,
  selected,
}: {
  id: string;
  isHistoryUncertain: boolean;
  onSelectDay: (date: string) => void;
  selectableDays: readonly SelectableCalendarDay[];
  selected: Nullable<SelectableCalendarDay>;
}) {
  const locale = useLocale();
  const t = useTranslations("statistics.calendar.books");
  const headingId = useId();

  if (selected === null) {
    return (
      <Card className={DAY_PANEL_CLASS.root} id={id}>
        <p className={DAY_PANEL_CLASS.empty.title}>{t("dayDetailsTitle")}</p>
        <div className={DAY_PANEL_CLASS.empty.message}>
          <UiIcon
            aria-hidden
            className={DAY_PANEL_CLASS.empty.icon}
            name={isHistoryUncertain ? "info" : "calendar-x"}
            size={16}
          />
          <div className="flex min-w-0 flex-col gap-0.5">
            <p className={DAY_PANEL_CLASS.empty.text}>
              {isHistoryUncertain ? t("dayPanelEmptyUncertain") : t("dayPanelEmpty")}
            </p>
            {isHistoryUncertain ? (
              <p className={DAY_PANEL_CLASS.empty.note}>{t("emptyMonthUncertainDescription")}</p>
            ) : null}
          </div>
        </div>
      </Card>
    );
  }

  const index = selectableDays.findIndex((day) => day.date === selected.date);
  const previous = index > 0 ? selectableDays[index - 1] : undefined;
  const next = index >= 0 ? selectableDays[index + 1] : undefined;

  return (
    <Card aria-labelledby={headingId} className={DAY_PANEL_CLASS.root} id={id} role="region">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className={DAY_PANEL_CLASS.eyebrow}>{t("dayDetailsTitle")}</p>
          <h3 aria-live="polite" className={DAY_PANEL_CLASS.title} id={headingId}>
            {formatDayLong(selected.date, locale)}
          </h3>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            aria-disabled={previous === undefined}
            aria-label={t("previousDay")}
            className={DAY_PANEL_CLASS.step}
            onClick={() => {
              if (previous !== undefined) onSelectDay(previous.date);
            }}
            size="icon-lg"
            variant="ghost"
          >
            <UiIcon name="chevron-left" size={16} />
          </Button>
          <Button
            aria-disabled={next === undefined}
            aria-label={t("nextDay")}
            className={DAY_PANEL_CLASS.step}
            onClick={() => {
              if (next !== undefined) onSelectDay(next.date);
            }}
            size="icon-lg"
            variant="ghost"
          >
            <UiIcon name="chevron-right" size={16} />
          </Button>
        </div>
      </div>
      <ReadingDayDetails date={selected.detailDate} variant="panel" />
    </Card>
  );
}
