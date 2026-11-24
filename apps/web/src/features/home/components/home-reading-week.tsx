"use client";

import type {
  HomeReadingWeek as HomeReadingWeekData,
  HomeReadingWeekDay,
  Nullable,
} from "@app/shared";
import type { ReactNode } from "react";

import { format, parseISO } from "date-fns";
import { useLocale, useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Link } from "@/i18n/navigation";
import { assertNever } from "@/lib/assert-never";
import { formatDateShort, formatDayMonth } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { HomeReadingWidget } from "../model/home-reading";

import { HOME_CONTEXT_LINKS } from "../model/home-context-links";
import {
  homeWeekDayHref,
  homeWeekDayPreview,
  homeWeekStreakDays,
  homeWeekSummary,
  isConfirmedQuietWeek,
} from "../model/home-reading-week";
import { HomeCard } from "./home-card";
import { HomeHeaderLink } from "./home-header-link";
import { HomeSectionError } from "./home-section-error";
import { HomeStaleNotice } from "./home-stale-notice";

type HomeReadingWeekProps = {
  isRetrying: boolean;
  onRetry: () => void;
  widget: HomeReadingWidget<HomeReadingWeekData>;
};

const WEEK_SKELETON_KEYS = ["d1", "d2", "d3", "d4", "d5", "d6", "d7"] as const;

const DAY_CELL_STYLES = {
  active: "bg-primary text-primary-foreground",
  base: "grid size-8 place-items-center rounded-full text-xs font-medium tabular-nums @2xl/home:size-10",
  future: "border border-dashed border-border text-muted-foreground",
  inactive: "bg-muted text-muted-foreground",
  today: "ring-2 ring-primary ring-offset-2 ring-offset-card",
  unknown: "border border-border bg-card text-muted-foreground",
} as const;

export function HomeReadingWeek({ isRetrying, onRetry, widget }: HomeReadingWeekProps) {
  const t = useTranslations("home.week");

  return (
    <HomeCard
      action={
        <HomeHeaderLink href={HOME_CONTEXT_LINKS.readingCalendar}>{t("calendar")}</HomeHeaderLink>
      }
      className="h-full"
      icon="calendar"
      title={t("title")}
    >
      <ReadingWeekBody isRetrying={isRetrying} onRetry={onRetry} widget={widget} />
    </HomeCard>
  );
}

function DayLink({
  children,
  href,
  label,
  preview,
}: {
  children: ReactNode;
  href: string;
  label: string;
  preview: Nullable<string>;
}) {
  const link = (
    <Link
      aria-label={label}
      className="cursor-pointer rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      href={href}
    >
      {children}
    </Link>
  );

  if (preview === null || preview.length === 0) return link;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent>{preview}</TooltipContent>
    </Tooltip>
  );
}

function DayMarker({ day }: { day: HomeReadingWeekDay }) {
  switch (day.status) {
    case "active":
      return <UiIcon aria-hidden name="check" size={16} />;
    case "future":
    case "inactive":
      return <span aria-hidden>{format(parseISO(day.date), "d")}</span>;
    case "unknown":
      return <UiIcon aria-hidden name="help-circle" size={14} />;
    default:
      return assertNever(day.status);
  }
}

function ReadingWeekBody({ isRetrying, onRetry, widget }: HomeReadingWeekProps) {
  const t = useTranslations("home.week");
  const tCommon = useTranslations("common");

  switch (widget.kind) {
    case "error":
      return (
        <HomeSectionError
          isRetrying={isRetrying}
          onRetry={onRetry}
          retryLabel={t("error.retry")}
          title={t("error.title")}
        />
      );
    case "fresh":
    case "stale":
      return (
        <div className="flex flex-1 flex-col gap-3">
          {widget.kind === "stale" ? (
            <HomeStaleNotice isRetrying={isRetrying} onRetry={onRetry} />
          ) : null}
          <WeekContent week={widget.data} />
        </div>
      );
    case "loading":
      return (
        <div aria-busy className="flex flex-col gap-3">
          <span className="sr-only" role="status">
            {tCommon("loading")}
          </span>
          <Skeleton className="h-4 w-32" />
          <div className="grid grid-cols-7 justify-items-center gap-1">
            {WEEK_SKELETON_KEYS.map((key) => (
              <div className="flex flex-col items-center gap-1.5" key={key}>
                <Skeleton className="h-3 w-5" />
                <Skeleton className="size-8 rounded-full @2xl/home:size-10" />
              </div>
            ))}
          </div>
          <Skeleton className="h-4 w-40" />
        </div>
      );
    default:
      return assertNever(widget);
  }
}

function WeekContent({ week }: { week: HomeReadingWeekData }) {
  const t = useTranslations("home.week");
  const locale = useLocale();
  const streakDays = homeWeekStreakDays(week);

  return (
    <>
      <p className="text-sm text-muted-foreground">
        {t("range", {
          from: formatDateShort(week.period.from, locale),
          to: formatDateShort(week.period.to, locale),
        })}
      </p>
      <ol className="grid grid-cols-7 justify-items-center gap-1">
        {week.days.map((day) => (
          <WeekDay day={day} isToday={day.date === week.today} key={day.date} />
        ))}
      </ol>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm">
        <WeekSummary week={week} />
        {streakDays === null ? null : (
          <span className="flex items-center gap-1.5 text-foreground">
            <UiIcon aria-hidden className="text-primary" name="flame" size={16} />
            {t("streak", { count: streakDays })}
          </span>
        )}
      </div>
      {isConfirmedQuietWeek(week) ? (
        <p className="text-xs text-muted-foreground">{t("quiet")}</p>
      ) : null}
    </>
  );
}

function WeekDay({ day, isToday }: { day: HomeReadingWeekDay; isToday: boolean }) {
  const t = useTranslations("home.week.day");
  const locale = useLocale();
  const date = parseISO(day.date);
  const weekday = new Intl.DateTimeFormat(locale, { weekday: "short" }).format(date);
  const href = homeWeekDayHref(day);
  const preview = homeWeekDayPreview(day);
  const previewText =
    preview === null
      ? null
      : [
          preview.pagesRead === null ? null : t("pages", { count: preview.pagesRead }),
          preview.booksCount === null ? null : t("books", { count: preview.booksCount }),
        ]
          .filter((part) => part !== null)
          .join(" · ");
  const label = [
    t("label", { date: formatDayMonth(day.date, locale), status: t(`status.${day.status}`) }),
    isToday ? t("today") : null,
    previewText,
  ]
    .filter((part) => part !== null && part.length > 0)
    .join(", ");

  const marker = (
    <span
      className={cn(
        DAY_CELL_STYLES.base,
        DAY_CELL_STYLES[day.status],
        isToday && DAY_CELL_STYLES.today,
      )}
    >
      <DayMarker day={day} />
    </span>
  );

  return (
    <li className="flex min-w-0 flex-col items-center gap-1.5">
      <span aria-hidden className="text-xs text-muted-foreground">
        {weekday}
      </span>
      {href === null ? (
        <span aria-label={label} role="img">
          {marker}
        </span>
      ) : (
        <DayLink href={href} label={label} preview={previewText}>
          {marker}
        </DayLink>
      )}
    </li>
  );
}

function WeekSummary({ week }: { week: HomeReadingWeekData }) {
  const t = useTranslations("home.week.summary");
  const summary = homeWeekSummary(week);

  return (
    <span className="font-medium text-foreground tabular-nums">
      {t(summary.kind, { count: summary.value })}
    </span>
  );
}
