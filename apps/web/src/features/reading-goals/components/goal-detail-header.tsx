"use client";

import type { ReadingGoalDetail } from "@app/shared";
import type { ReactNode } from "react";

import { useLocale, useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Link } from "@/i18n/navigation";
import { formatDateLong } from "@/lib/format";

import { GOAL_STATUS_BADGE } from "../model/goal-status";
import { useGoalTimeNote } from "../model/use-goal-time-note";

type GoalDetailHeaderProps = {
  actions: ReactNode;
  goal: ReadingGoalDetail;
};

type GoalDetailPartProps = {
  goal: ReadingGoalDetail;
};

export function GoalDetailHeader({ actions, goal }: GoalDetailHeaderProps) {
  const t = useTranslations("goals.detail");
  const tGoals = useTranslations("goals");
  const locale = useLocale();
  const timeNote = useGoalTimeNote(goal);
  const meta = [t("deadline", { date: formatDateLong(goal.deadline, locale) }), timeNote]
    .filter((part) => part !== null)
    .join(" · ");

  return (
    <>
      <GoalBackLink goal={goal} />

      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="min-w-0 font-heading text-2xl font-semibold break-words text-ink">
            {goal.name ??
              tGoals("fallbackName", {
                count: goal.targetCount,
                date: formatDateLong(goal.deadline, locale),
              })}
          </h1>
          <GoalStatusLabels goal={goal} />
        </div>
        <p className="text-sm text-muted-foreground">{meta}</p>
        {actions}
      </header>

      <GoalDetailProgress goal={goal} />
    </>
  );
}

function GoalBackLink({ goal }: GoalDetailPartProps) {
  const t = useTranslations("goals.detail");

  return (
    <Link
      className="inline-flex w-fit max-w-full items-center gap-1.5 rounded-sm text-sm break-words text-muted-foreground no-underline transition-colors outline-none hover:text-foreground focus-visible:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      href={goal.list === null ? "/goals" : `/lists/${goal.list.id}`}
    >
      <UiIcon aria-hidden className="shrink-0" name="arrow-left" size={16} />
      {goal.list === null ? t("backToGoals") : t("back", { name: goal.list.name })}
    </Link>
  );
}

function GoalDetailProgress({ goal }: GoalDetailPartProps) {
  const t = useTranslations("goals.detail");
  const percent = Math.round(goal.progressPercent);

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-soft">
      <div className="flex items-center gap-3">
        <Progress
          aria-label={t("progressLabel", { percent })}
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={percent}
          className="h-2.5 flex-1"
          value={percent}
        />
        <span className="shrink-0 text-sm font-semibold text-primary tabular-nums">{percent}%</span>
      </div>
      <p className="text-sm text-foreground tabular-nums">
        {t("progress", { completed: goal.completedCount, target: goal.targetCount })}
      </p>
      {goal.remainingCount === 0 ? null : (
        <p className="text-sm text-muted-foreground">
          {t("remaining", { count: goal.remainingCount })}
        </p>
      )}
    </section>
  );
}

function GoalStatusLabels({ goal }: GoalDetailPartProps) {
  const tResult = useTranslations("goals.result");
  const tStatus = useTranslations("goals.status");
  const badge = GOAL_STATUS_BADGE[goal.status];

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge className="h-6 gap-1.5 px-2.5" variant={badge.tone}>
        <UiIcon aria-hidden name={badge.icon} size={12} />
        {tStatus(goal.status)}
      </Badge>
      {goal.status === "archived" ? (
        <Badge className="h-6 px-2.5" variant="outline">
          {tResult(goal.result ?? "none")}
        </Badge>
      ) : null}
    </div>
  );
}
