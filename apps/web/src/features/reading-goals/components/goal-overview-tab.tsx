"use client";

import type { Nullable, ReadingGoalDetail } from "@app/shared";
import type { ReactNode } from "react";

import { useLocale, useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { assertNever } from "@/lib/assert-never";
import { formatDateLong } from "@/lib/format";

import { GOAL_SIGNAL_TONE } from "../model/goal-status";
import { useGoalTimeNote } from "../model/use-goal-time-note";
import { GoalActivityPreview } from "./goal-activity-preview";
import { GoalCheckpointList } from "./goal-checkpoint-list";

type GoalOverviewPartProps = {
  goal: ReadingGoalDetail;
};

type GoalOverviewTabProps = {
  goal: ReadingGoalDetail;
  onShowActivity: () => void;
};

export function GoalOverviewTab({ goal, onShowActivity }: GoalOverviewTabProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 md:grid-cols-2">
        <GoalTimeStats goal={goal} />
        <GoalPaceSummary goal={goal} />
        <GoalRiskSummary goal={goal} />
        <GoalProjectionSummary goal={goal} />
      </div>
      <GoalCheckpointList checkpoints={goal.checkpoints} />
      <GoalActivityPreview items={goal.activityPreview} onShowAll={onShowActivity} />
    </div>
  );
}

function GoalPaceSummary({ goal }: GoalOverviewPartProps) {
  const t = useTranslations("goals.detail.overview.pace");
  const tPace = useTranslations("goals.pace");
  const locale = useLocale();

  function rate(booksPerDay: Nullable<number>, daysPerBook: Nullable<number>): Nullable<string> {
    const parts = [
      booksPerDay === null ? null : t("booksPerDay", { count: booksPerDay }),
      daysPerBook === null ? null : t("daysPerBook", { count: daysPerBook }),
    ].filter((part) => part !== null);
    return parts.length === 0 ? null : parts.join(" · ");
  }

  function paceDelta(delta: Nullable<number>): Nullable<string> {
    if (delta === null || delta === 0) return null;
    return delta > 0 ? t("ahead", { count: delta }) : t("behind", { count: Math.abs(delta) });
  }

  function lastCounted(): string {
    if (goal.lastCountedAt === null) return t("noneCounted");
    const date = formatDateLong(goal.lastCountedAt, locale);
    if (goal.daysSinceLastCounted === null) return date;
    return `${date} · ${t("daysAgo", { count: goal.daysSinceLastCounted })}`;
  }

  const actualRate = rate(goal.actualBooksPerDay, goal.averageDaysPerBook);
  const requiredRate = rate(goal.requiredBooksPerDay, goal.requiredDaysPerBook);
  const delta = paceDelta(goal.paceDeltaBooks);

  return (
    <OverviewCard title={t("title")}>
      {goal.pace === null ? (
        <p className="text-sm text-muted-foreground">{t("unavailable")}</p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="h-6 px-2.5" variant={GOAL_SIGNAL_TONE.pace[goal.pace]}>
            {tPace(goal.pace)}
          </Badge>
          {delta === null ? null : (
            <span className="text-sm text-muted-foreground tabular-nums">{delta}</span>
          )}
        </div>
      )}
      <dl className="grid gap-3">
        <OverviewStat label={t("actual")} value={actualRate ?? t("noData")} />
        {requiredRate === null ? null : <OverviewStat label={t("required")} value={requiredRate} />}
        <OverviewStat label={t("lastCounted")} value={lastCounted()} />
      </dl>
    </OverviewCard>
  );
}

function GoalProjectionSummary({ goal }: GoalOverviewPartProps) {
  const t = useTranslations("goals.detail.overview.projection");

  if (goal.status !== "active") return null;

  return (
    <OverviewCard title={t("title")}>
      <ProjectionForecast goal={goal} />
    </OverviewCard>
  );
}

function GoalRiskSummary({ goal }: GoalOverviewPartProps) {
  const t = useTranslations("goals.detail.overview.risk");
  const tReason = useTranslations("goals.detail.overview.risk.reasons");
  const tRisk = useTranslations("goals.risk");
  const { riskLevel, riskReasons } = goal;
  const hasRiskSignals = riskLevel !== "none" || riskReasons.length > 0;

  if (!hasRiskSignals && goal.status !== "active") return null;

  return (
    <OverviewCard title={t("title")}>
      {riskLevel === "none" ? null : (
        <Badge className="h-6 w-fit px-2.5" variant={GOAL_SIGNAL_TONE.risk[riskLevel]}>
          {tRisk(riskLevel)}
        </Badge>
      )}
      {hasRiskSignals ? null : <p className="text-sm text-muted-foreground">{t("none")}</p>}
      {riskReasons.length === 0 ? null : (
        <ul className="flex flex-col gap-2">
          {riskReasons.map((reason) => (
            <li className="flex items-start gap-2 text-sm text-foreground" key={reason}>
              <UiIcon
                aria-hidden
                className="mt-0.5 shrink-0 text-warning"
                name="alert-circle"
                size={16}
              />
              <span className="min-w-0">{tReason(reason)}</span>
            </li>
          ))}
        </ul>
      )}
    </OverviewCard>
  );
}

function GoalTimeStats({ goal }: GoalOverviewPartProps) {
  const t = useTranslations("goals.detail.overview.stats");
  const locale = useLocale();
  const timeNote = useGoalTimeNote(goal);

  return (
    <OverviewCard title={t("title")}>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
        <OverviewStat
          label={t("counted")}
          value={t("countedValue", { completed: goal.completedCount, target: goal.targetCount })}
        />
        <OverviewStat
          label={t("remaining")}
          value={t("remainingValue", { count: goal.remainingCount })}
        />
        <OverviewStat
          label={t("elapsed")}
          value={t("elapsedValue", { elapsed: goal.elapsedDays, total: goal.totalDays })}
        />
        <OverviewStat label={t("deadline")} value={formatDateLong(goal.deadline, locale)} />
      </dl>
      {timeNote === null ? null : <p className="text-sm text-muted-foreground">{timeNote}</p>}
    </OverviewCard>
  );
}

function OverviewCard({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-soft">
      <h2 className="font-heading text-base font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}

function OverviewStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-semibold break-words text-ink tabular-nums">{value}</dd>
    </div>
  );
}

function ProjectionForecast({ goal }: GoalOverviewPartProps) {
  const t = useTranslations("goals.detail.overview.projection");
  const tConfidence = useTranslations("goals.detail.overview.projection.confidence");
  const locale = useLocale();
  const { projectedCompletionDate, projectedDaysDelta, projectionConfidence } = goal;

  function deadlineDelta(): Nullable<string> {
    if (projectedDaysDelta === null) return null;
    if (projectedDaysDelta > 0) return t("early", { count: projectedDaysDelta });
    if (projectedDaysDelta < 0) return t("late", { count: Math.abs(projectedDaysDelta) });
    return t("onDeadline");
  }

  switch (projectionConfidence) {
    case "high":
    case "medium": {
      if (projectedCompletionDate === null) {
        return <p className="text-sm text-muted-foreground">{t("none")}</p>;
      }
      const delta = deadlineDelta();
      return (
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-ink">
            {t("date", { date: formatDateLong(projectedCompletionDate, locale) })}
          </p>
          {delta === null ? null : <p className="text-sm text-muted-foreground">{delta}</p>}
          <p className="text-xs text-muted-foreground">{tConfidence(projectionConfidence)}</p>
        </div>
      );
    }
    case "low":
      return <p className="text-sm text-muted-foreground">{t("low")}</p>;
    case "none":
      return <p className="text-sm text-muted-foreground">{t("none")}</p>;
    default:
      return assertNever(projectionConfidence);
  }
}
