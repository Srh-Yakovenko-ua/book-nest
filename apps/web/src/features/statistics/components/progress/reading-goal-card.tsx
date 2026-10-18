"use client";

import type { ReadingStatisticsGoalSection } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Link } from "@/i18n/navigation";
import { formatDateShort } from "@/lib/format";

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

  const percent = Math.round(primary.metrics.progressPercent);
  const links = toContextActionLinks(primary.contextActions);

  return (
    <StatisticsSection
      description={t("deadline", { date: formatDateShort(primary.deadline, locale) })}
      title={t("currentTitle")}
    >
      <GoalProgress
        completed={primary.metrics.completedCount}
        name={primary.name ?? primary.listName ?? t("fallbackName", { count: primary.targetCount })}
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
  const tStatus = useTranslations("goals.status");
  const primary = goal.primaryGoal;
  const snapshotNote = <p className="text-xs text-muted-foreground">{t("snapshotNote")}</p>;

  if (primary === null) {
    return (
      <StatisticsSection description={t("description")} note={snapshotNote} title={t("title")}>
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

  const percent = Math.round(primary.metrics.progressPercent);
  const links = toContextActionLinks(primary.contextActions);

  return (
    <StatisticsSection
      description={t("deadline", { date: formatDateShort(primary.deadline, locale) })}
      note={snapshotNote}
      title={t("title")}
    >
      <GoalProgress
        completed={primary.metrics.completedCount}
        name={primary.name ?? primary.listName ?? t("fallbackName", { count: primary.targetCount })}
        percent={percent}
        target={primary.targetCount}
      />

      <dl className="flex flex-col gap-1 text-xs">
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">{t("status")}</dt>
          <dd className="font-medium text-foreground">{tStatus(primary.status)}</dd>
        </div>
        {primary.metrics.pace === null ? null : (
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">{t("pace")}</dt>
            <dd className="font-medium text-foreground">{t(`paces.${primary.metrics.pace}`)}</dd>
          </div>
        )}
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">{t("remaining")}</dt>
          <dd className="font-medium text-foreground tabular-nums">
            {t("remainingValue", { count: primary.metrics.remainingCount })}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">{t("forecast")}</dt>
          <dd className="font-medium text-foreground">
            {primary.metrics.projectedCompletionDate === null ||
            primary.metrics.projectionConfidence === "none" ||
            primary.metrics.projectionConfidence === "low"
              ? t("forecastUnavailable")
              : formatDateShort(primary.metrics.projectedCompletionDate, locale)}
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

function GoalProgress({
  completed,
  name,
  percent,
  target,
}: {
  completed: number;
  name: string;
  percent: number;
  target: number;
}) {
  const t = useTranslations("statistics.goal");

  return (
    <div className="flex flex-col gap-2">
      <span className="truncate text-sm font-medium text-foreground">{name}</span>
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
