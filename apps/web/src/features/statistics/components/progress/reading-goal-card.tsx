"use client";

import type { Nullable, ReadingGoalMetrics, ReadingStatisticsGoalSection } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { GOAL_SIGNAL_TONE } from "@/features/reading-goals/model/goal-status";
import { Link } from "@/i18n/navigation";
import { formatDateLong, formatDateShort } from "@/lib/format";
import { cn } from "@/lib/utils";

import {
  type StatisticsContextActionLink,
  toContextActionLinks,
} from "../../model/statistics-drilldown";
import { StatisticsSection } from "../statistics-section";
import { StatisticsSectionState } from "../statistics-states";

export function ReadingGoalCard({
  goal,
  variant,
}: {
  goal: ReadingStatisticsGoalSection;
  variant: "compact" | "full";
}) {
  return variant === "compact" ? (
    <CompactReadingGoal goal={goal} />
  ) : (
    <FullReadingGoal goal={goal} />
  );
}

function CompactReadingGoal({ goal }: { goal: ReadingStatisticsGoalSection }) {
  const locale = useLocale();
  const t = useTranslations("statistics.goal");
  const primary = goal.primaryGoal;

  if (primary === null) {
    return (
      <StatisticsSection title={t("currentTitle")}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm text-muted-foreground">{t("empty")}</span>
          <Button asChild size="sm" variant="secondary">
            <Link href="/goals">
              <UiIcon name="plus" size={16} />
              {t("create")}
            </Link>
          </Button>
        </div>
      </StatisticsSection>
    );
  }

  const percent = toDisplayPercent(primary.metrics);
  const links = toContextActionLinks(primary.contextActions);

  return (
    <StatisticsSection
      description={t("deadline", { date: formatDateShort(primary.deadline, locale) })}
      title={t("currentTitle")}
    >
      <GoalProgress
        completed={primary.metrics.completedCount}
        name={primary.name ?? primary.listName ?? t("fallbackName", { count: primary.targetCount })}
        nameClassName="truncate"
        percent={percent}
        target={primary.targetCount}
      />
      <GoalLinks activeGoalsCount={goal.activeGoalsCount} links={links} />
    </StatisticsSection>
  );
}

function FullReadingGoal({ goal }: { goal: ReadingStatisticsGoalSection }) {
  const locale = useLocale();
  const t = useTranslations("statistics.goal");
  const primary = goal.primaryGoal;

  if (primary === null) {
    return (
      <StatisticsSection description={t("description")} title={t("title")}>
        <StatisticsSectionState
          action={
            <Button asChild size="sm" variant="secondary">
              <Link href="/goals">
                <UiIcon name="plus" size={16} />
                {t("create")}
              </Link>
            </Button>
          }
          description={t("emptyDescription")}
          kind="empty"
          title={t("empty")}
        />
      </StatisticsSection>
    );
  }

  const percent = toDisplayPercent(primary.metrics);
  const forecastDate = toReliableForecastDate(primary.metrics);
  const links = toContextActionLinks(primary.contextActions);

  return (
    <StatisticsSection description={t("description")} title={t("title")}>
      <GoalProgress
        completed={primary.metrics.completedCount}
        name={primary.name ?? primary.listName ?? t("fallbackName", { count: primary.targetCount })}
        nameClassName="break-words"
        percent={percent}
        target={primary.targetCount}
      />

      <GoalPace pace={primary.metrics.pace} />

      <dl className="flex flex-col gap-1 text-xs">
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">{t("deadlineLabel")}</dt>
          <dd className="font-medium text-foreground">
            {formatDateLong(primary.deadline, locale)}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">{t("remaining")}</dt>
          <dd className="font-medium text-foreground tabular-nums">
            {t("remainingValue", { count: primary.metrics.remainingCount })}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">{t("forecast")}</dt>
          <dd className="text-right font-medium text-foreground">
            {forecastDate === null
              ? t("forecastUnavailable")
              : formatDateLong(forecastDate, locale)}
          </dd>
        </div>
      </dl>

      <GoalLinks activeGoalsCount={goal.activeGoalsCount} links={links} />
    </StatisticsSection>
  );
}

function GoalLinks({
  activeGoalsCount,
  links,
}: {
  activeGoalsCount: number;
  links: readonly StatisticsContextActionLink[];
}) {
  const t = useTranslations("statistics.goal");

  return (
    <div className="flex flex-wrap items-center gap-2">
      {links.map((link) => (
        <Button asChild key={link.kind} size="sm" variant="secondary">
          <Link href={link.href}>{t("open")}</Link>
        </Button>
      ))}
      {activeGoalsCount <= 1 ? null : (
        <Link
          className="inline-flex min-h-9 items-center rounded-md px-1 text-xs text-primary outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
          href="/goals"
        >
          {t("otherGoals", { count: activeGoalsCount - 1 })}
        </Link>
      )}
    </div>
  );
}

function GoalPace({ pace }: { pace: ReadingGoalMetrics["pace"] }) {
  const t = useTranslations("statistics.goal");

  return (
    <dl className="flex flex-wrap items-center gap-2">
      <dt className="text-xs text-muted-foreground">{t("pace")}</dt>
      <dd>
        <Badge
          className="h-auto min-h-6 max-w-full px-2.5 whitespace-normal"
          variant={pace === null ? "secondary" : GOAL_SIGNAL_TONE.pace[pace]}
        >
          {pace === null ? t("paceUnknown") : t(`paces.${pace}`)}
        </Badge>
      </dd>
    </dl>
  );
}

function GoalProgress({
  completed,
  name,
  nameClassName,
  percent,
  target,
}: {
  completed: number;
  name: string;
  nameClassName: string;
  percent: number;
  target: number;
}) {
  const t = useTranslations("statistics.goal");

  return (
    <div className="flex flex-col gap-2">
      <span className={cn("text-sm font-medium text-foreground", nameClassName)}>{name}</span>
      <span className="font-heading text-lg font-semibold text-ink tabular-nums">
        {t("progress", { completed, target })}
      </span>
      <div className="flex items-center gap-2">
        <Progress
          aria-label={t("progressLabel", { percent })}
          className="h-2 flex-1"
          value={percent}
        />
        <span className="shrink-0 text-sm font-semibold text-primary tabular-nums">{percent}%</span>
      </div>
    </div>
  );
}

function toDisplayPercent(metrics: ReadingGoalMetrics): number {
  const rounded = Math.round(metrics.progressPercent);
  return metrics.remainingCount > 0 ? Math.min(rounded, 99) : rounded;
}

function toReliableForecastDate(metrics: ReadingGoalMetrics): Nullable<string> {
  const isReliable =
    metrics.projectionConfidence === "medium" || metrics.projectionConfidence === "high";
  return isReliable ? metrics.projectedCompletionDate : null;
}
