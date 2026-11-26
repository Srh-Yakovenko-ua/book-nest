"use client";

import type { Nullable, ReadingGoalDetail } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";

import type { UiIconName } from "@/components/icons";

import { UiIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { assertNever } from "@/lib/assert-never";
import { formatDateLong } from "@/lib/format";

import type { GoalRateFigure } from "../model/goal-pace-figures";

import { resolveGoalRateFigure } from "../model/goal-pace-figures";
import { GoalOverviewCard } from "./goal-overview-card";
import { GoalStateIllustration } from "./goal-state-illustration";

type GoalDeadlineDelta = {
  icon: UiIconName;
  text: string;
  tone: "info" | "success" | "warning";
};

type GoalPaceForecastCardProps = {
  goal: ReadingGoalDetail;
};

type GoalRateStatProps = {
  figure: GoalRateFigure;
  label: string;
};

export function GoalPaceForecastCard({ goal }: GoalPaceForecastCardProps) {
  const t = useTranslations("goals.detail.overview.pace");
  const isActive = goal.status === "active";
  const actualRate = resolveGoalRateFigure({
    booksPerDay: goal.actualBooksPerDay,
    daysPerBook: goal.averageDaysPerBook,
  });
  const requiredRate = resolveGoalRateFigure({
    booksPerDay: goal.requiredBooksPerDay,
    daysPerBook: goal.requiredDaysPerBook,
  });

  return (
    <GoalOverviewCard icon="chart" title={isActive ? t("title") : t("titleClosed")}>
      <dl className="grid gap-3">
        <GoalRateStat figure={actualRate} label={t("actual")} />
        {isActive ? <GoalRateStat figure={requiredRate} label={t("required")} /> : null}
        <GoalLastCountedStat goal={goal} />
      </dl>
      {isActive ? <GoalForecast goal={goal} /> : null}
    </GoalOverviewCard>
  );
}

function GoalForecast({ goal }: GoalPaceForecastCardProps) {
  const t = useTranslations("goals.detail.overview.projection");
  const tConfidence = useTranslations("goals.detail.overview.projection.confidence");
  const locale = useLocale();
  const { completedCount, projectedCompletionDate, projectedDaysDelta, projectionConfidence } =
    goal;

  function deadlineDelta(): Nullable<GoalDeadlineDelta> {
    if (projectedDaysDelta === null) return null;
    if (projectedDaysDelta > 0) {
      return {
        icon: "check-circle",
        text: t("early", { count: projectedDaysDelta }),
        tone: "success",
      };
    }
    if (projectedDaysDelta < 0) {
      return {
        icon: "clock",
        text: t("late", { count: Math.abs(projectedDaysDelta) }),
        tone: "warning",
      };
    }
    return { icon: "calendar", text: t("onDeadline"), tone: "info" };
  }

  if (
    projectionConfidence === "none" ||
    projectionConfidence === "low" ||
    projectedCompletionDate === null
  ) {
    return <GoalForecastInsufficient />;
  }

  const delta = deadlineDelta();

  return (
    <div className="flex flex-col gap-2 border-t border-border pt-4">
      <h3 className="text-xs font-normal text-muted-foreground">{t("title")}</h3>
      <p className="font-heading text-lg leading-tight font-semibold text-ink">
        {formatDateLong(projectedCompletionDate, locale)}
      </p>
      {delta === null ? null : (
        <Badge className="h-6 gap-1.5 px-2.5" variant={delta.tone}>
          <UiIcon name={delta.icon} size={12} />
          {delta.text}
        </Badge>
      )}
      <p className="text-xs font-medium text-foreground">{tConfidence(projectionConfidence)}</p>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {t("basis", { count: completedCount })}
      </p>
    </div>
  );
}

function GoalForecastInsufficient() {
  const t = useTranslations("goals.detail.overview.projection");

  return (
    <div className="flex items-center gap-3 border-t border-border pt-4">
      <GoalStateIllustration name="forecastInsufficient" />
      <p className="min-w-0 text-sm text-muted-foreground">{t("insufficient")}</p>
    </div>
  );
}

function GoalLastCountedStat({ goal }: GoalPaceForecastCardProps) {
  const t = useTranslations("goals.detail.overview.pace");
  const locale = useLocale();
  const { daysSinceLastCounted, lastCountedAt } = goal;

  function lastCounted(): string {
    if (lastCountedAt === null) return t("noneCounted");
    const date = formatDateLong(lastCountedAt, locale);
    if (daysSinceLastCounted === null) return date;
    return `${date} · ${t("daysAgo", { count: daysSinceLastCounted })}`;
  }

  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{t("lastCounted")}</dt>
      <dd className="text-sm font-semibold break-words text-ink tabular-nums">{lastCounted()}</dd>
    </div>
  );
}

function GoalRateStat({ figure, label }: GoalRateStatProps) {
  const t = useTranslations("goals.detail.overview.pace");

  function primaryText(): string {
    switch (figure.kind) {
      case "books_per_day":
        return t("booksPerDay", { count: figure.booksPerDay });
      case "days_per_book":
        return t("daysPerBook", { count: figure.daysPerBook });
      case "missing":
        return t("noData");
      default:
        return assertNever(figure);
    }
  }

  const detail =
    figure.kind === "days_per_book" && figure.booksPerDay !== null
      ? t("booksPerDay", { count: figure.booksPerDay })
      : null;

  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-semibold break-words text-ink tabular-nums">{primaryText()}</dd>
      {detail === null ? null : (
        <dd className="text-xs text-muted-foreground tabular-nums">{detail}</dd>
      )}
    </div>
  );
}
