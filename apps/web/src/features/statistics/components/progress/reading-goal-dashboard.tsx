"use client";

import type { Nullable, ReadingGoalMetrics, ReadingStatisticsGoalSection } from "@app/shared";
import type { ReactNode } from "react";

import { useLocale, useTranslations } from "next-intl";

import type { UiIconName } from "@/components/icons";

import { UiIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { GOAL_SIGNAL_TONE, goalDisplayPercent } from "@/features/reading-goals";
import { Link } from "@/i18n/navigation";
import { formatDateLong } from "@/lib/format";

import { toContextActionLinks } from "../../model/statistics-drilldown";
import { StatisticsSectionState } from "../statistics-states";
import { ProgressCard, progressFigure } from "./progress-card";
import { ProgressInfoHint } from "./progress-info-hint";

type GoalPrimary = NonNullable<ReadingStatisticsGoalSection["primaryGoal"]>;

export function ReadingGoalDashboard({ goal }: { goal: ReadingStatisticsGoalSection }) {
  const t = useTranslations("statistics.goal");
  const primary = goal.primaryGoal;

  if (primary === null) {
    return (
      <ProgressCard
        description={t("description")}
        icon="target"
        illustration="goal"
        title={t("title")}
      >
        <StatisticsSectionState
          action={
            <Button asChild className="mt-1" size="lg" variant="secondary">
              <Link href="/goals">
                <UiIcon aria-hidden name="plus" size={16} />
                {t("create")}
              </Link>
            </Button>
          }
          density="compact"
          description={t("emptyDescription")}
          kind="empty"
          title={t("empty")}
        />
      </ProgressCard>
    );
  }

  return (
    <ProgressCard
      action={
        goal.activeGoalsCount <= 1 ? undefined : (
          <OtherGoalsLink count={goal.activeGoalsCount - 1} />
        )
      }
      description={t("description")}
      icon="target"
      illustration="goal"
      lead={<GoalHeadline primary={primary} />}
      title={t("title")}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-border/60 pt-3">
        <GoalFacts primary={primary} />
        <div className="ml-auto flex flex-wrap gap-2">
          {toContextActionLinks(primary.contextActions).map((link) => (
            <Button asChild className="text-primary" key={link.kind} size="sm" variant="secondary">
              <Link href={link.href}>
                {t("open")}
                <UiIcon aria-hidden data-icon="inline-end" name="arrow-right" size={16} />
              </Link>
            </Button>
          ))}
        </div>
      </div>
    </ProgressCard>
  );
}

function GoalFact({ icon, label, value }: { icon: UiIconName; label: string; value: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="flex items-center gap-1.5 text-muted-foreground">
        <UiIcon aria-hidden className="shrink-0 text-primary" name={icon} size={14} />
        {label}
      </dt>
      <dd className="font-medium text-foreground">{value}</dd>
    </div>
  );
}

function GoalFacts({ primary }: { primary: GoalPrimary }) {
  const locale = useLocale();
  const t = useTranslations("statistics.goal");
  const forecastDate = toReliableForecastDate(primary.metrics);

  return (
    <dl className="flex min-w-0 flex-wrap gap-x-4 gap-y-2 text-xs">
      <GoalFact
        icon="calendar"
        label={t("deadlineLabel")}
        value={formatDateLong(primary.deadline, locale)}
      />
      <GoalFact
        icon="book"
        label={t("remaining")}
        value={t("remainingValue", { count: primary.metrics.remainingCount })}
      />
      <GoalFact
        icon="chart"
        label={t("forecast")}
        value={
          forecastDate === null ? (
            <span className="inline-flex items-center gap-0.5">
              {t("forecastNoData")}
              <ProgressInfoHint topic={t("forecast")}>{t("forecastUnavailable")}</ProgressInfoHint>
            </span>
          ) : (
            formatDateLong(forecastDate, locale)
          )
        }
      />
    </dl>
  );
}

function GoalHeadline({ primary }: { primary: GoalPrimary }) {
  const t = useTranslations("statistics.goal");
  const percent = goalDisplayPercent(primary.metrics);
  const pace = primary.metrics.pace;

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium break-words text-foreground">
        {primary.name ?? primary.listName ?? t("fallbackName", { count: primary.targetCount })}
      </span>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <p className="text-base font-medium text-foreground">
          {t.rich("progressBooks", {
            completed: primary.metrics.completedCount,
            num: progressFigure,
            target: primary.targetCount,
          })}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <dl className="flex items-center">
            <dt className="sr-only">{t("pace")}</dt>
            <dd>
              <Badge
                className="h-auto min-h-6 max-w-full px-2.5 whitespace-normal"
                variant={pace === null ? "secondary" : GOAL_SIGNAL_TONE.pace[pace]}
              >
                {pace === null ? t("paceUnknown") : t(`paces.${pace}`)}
              </Badge>
            </dd>
          </dl>
          <Badge
            className="h-auto min-h-6 shrink-0 px-2.5 text-sm font-semibold text-accent-foreground tabular-nums"
            variant="primary"
          >
            {percent}%
          </Badge>
        </div>
      </div>
      <Progress aria-label={t("progressLabel", { percent })} className="h-2" value={percent} />
    </div>
  );
}

function OtherGoalsLink({ count }: { count: number }) {
  const t = useTranslations("statistics.goal");

  return (
    <Link
      className="inline-flex min-h-9 items-center gap-1 rounded-full border border-border bg-card px-3 text-xs font-medium text-foreground outline-none hover:border-accent-border hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50 motion-safe:transition-colors"
      href="/goals"
    >
      {t("otherGoals", { count })}
      <UiIcon aria-hidden className="shrink-0" name="chevron-right" size={14} />
    </Link>
  );
}

function toReliableForecastDate(metrics: ReadingGoalMetrics): Nullable<string> {
  const isReliable =
    metrics.projectionConfidence === "medium" || metrics.projectionConfidence === "high";
  return isReliable ? metrics.projectedCompletionDate : null;
}
