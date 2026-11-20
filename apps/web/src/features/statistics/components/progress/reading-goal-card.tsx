"use client";

import type { ReadingGoalMetrics, ReadingStatisticsGoalSection } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { TruncatedText } from "@/components/truncated-text";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { goalDisplayPercent } from "@/features/reading-goals";
import { Link } from "@/i18n/navigation";
import { formatDateShort } from "@/lib/format";

import {
  type StatisticsContextActionLink,
  toContextActionLinks,
} from "../../model/statistics-drilldown";
import { StatisticsSection } from "../statistics-section";
import { ReadingGoalDashboard } from "./reading-goal-dashboard";

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
    <ReadingGoalDashboard goal={goal} />
  );
}

function CompactGoalCaption({ metrics }: { metrics: ReadingGoalMetrics }) {
  const t = useTranslations("statistics.goal");

  if (metrics.completedCount === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        {t("notStarted", { count: metrics.remainingCount })}
      </p>
    );
  }

  if (metrics.remainingCount === 0) return null;

  return (
    <dl className="flex items-baseline gap-1.5 text-xs">
      <dt className="text-muted-foreground">{t("remaining")}</dt>
      <dd className="font-medium text-foreground tabular-nums">
        {t("remainingValue", { count: metrics.remainingCount })}
      </dd>
    </dl>
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

  const percent = goalDisplayPercent(primary.metrics);
  const links = toContextActionLinks(primary.contextActions);
  const name =
    primary.name ?? primary.listName ?? t("fallbackName", { count: primary.targetCount });

  return (
    <StatisticsSection title={t("currentTitle")}>
      <div className="flex flex-col gap-3">
        <TruncatedText className="text-sm font-medium text-foreground" lines={1} text={name} />
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-heading text-3xl leading-none font-semibold text-ink tabular-nums">
              {t("progress", {
                completed: primary.metrics.completedCount,
                target: primary.targetCount,
              })}
            </span>
            <span className="shrink-0 text-sm font-semibold text-primary tabular-nums">
              {percent}%
            </span>
          </div>
          <Progress aria-label={t("progressLabel", { percent })} className="h-2" value={percent} />
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <CompactGoalCaption metrics={primary.metrics} />
            <span className="shrink-0 text-xs text-muted-foreground">
              {t("deadline", { date: formatDateShort(primary.deadline, locale) })}
            </span>
          </div>
        </div>
      </div>
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
