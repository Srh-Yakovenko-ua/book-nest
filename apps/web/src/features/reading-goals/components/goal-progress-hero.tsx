"use client";

import type { Nullable, ReadingGoalDetail, ReadingGoalStatus } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";
import { useId } from "react";

import type { UiIconName } from "@/components/icons";

import { UiIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useProfileTimeZone } from "@/features/settings";
import { assertNever } from "@/lib/assert-never";
import { formatDateLong } from "@/lib/format";
import { instantToIsoDay } from "@/lib/iso-day";
import { cn } from "@/lib/utils";

import type { GoalPlanGap } from "../model/goal-pace-figures";
import type { GoalStateIllustrationName } from "./goal-state-illustration";

import { goalDisplayPercent } from "../model/goal-display-percent";
import { resolveGoalPlanGap, roundToTenth } from "../model/goal-pace-figures";
import { GOAL_SIGNAL_TONE } from "../model/goal-status";
import { GoalStateIllustration } from "./goal-state-illustration";

type GoalHeroTimeNote = {
  caption: Nullable<string>;
  text: string;
};

type GoalProgressHeroProps = {
  goal: ReadingGoalDetail;
};

const GOAL_HERO_LOOK = {
  active: { icon: "calendar", illustration: null, tone: "text-icon" },
  archived: { icon: "inbox", illustration: null, tone: "text-muted-foreground" },
  completed: { icon: "trophy", illustration: "completed", tone: "text-success" },
  expired: { icon: "clock", illustration: "expired", tone: "text-warning" },
} as const satisfies Record<
  ReadingGoalStatus,
  { icon: UiIconName; illustration: Nullable<GoalStateIllustrationName>; tone: string }
>;

export function GoalProgressHero({ goal }: GoalProgressHeroProps) {
  const t = useTranslations("goals.detail");
  const legendId = useId();
  const percent = goalDisplayPercent(goal);
  const planPercent = goal.status === "active" ? Math.round(goal.elapsedPercent) : null;
  const { illustration } = GOAL_HERO_LOOK[goal.status];

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-soft sm:gap-4 sm:p-5">
      <div className="flex items-center gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6 sm:gap-y-3">
          <div className="flex min-w-0 items-center gap-3 sm:gap-6">
            <p className="shrink-0 font-heading text-3xl leading-none font-semibold text-ink tabular-nums sm:text-5xl">
              {percent}%
            </p>
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className="text-base font-semibold text-ink tabular-nums">
                {t("progress", { completed: goal.completedCount, target: goal.targetCount })}
              </p>
              <p className="text-sm text-muted-foreground tabular-nums">
                {t("hero.counted", { remaining: goal.remainingCount })}
              </p>
            </div>
          </div>
          <GoalHeroTimeNoteView goal={goal} />
        </div>
        {illustration === null ? null : <GoalStateIllustration name={illustration} />}
      </div>

      <div className="flex flex-col gap-2">
        <div className="relative py-1">
          <Progress
            aria-describedby={planPercent === null ? undefined : legendId}
            aria-label={t("progressLabel", { percent })}
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={percent}
            className="h-2.5 *:motion-reduce:transition-none"
            value={percent}
          />
          {planPercent === null ? null : (
            <span
              aria-hidden
              className="absolute inset-y-0 w-1 -translate-x-1/2 rounded-full bg-success ring-2 ring-card"
              style={{ left: `${planPercent}%` }}
            />
          )}
        </div>
        {planPercent === null ? null : (
          <ul
            className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground tabular-nums"
            id={legendId}
          >
            <li className="inline-flex items-center gap-1.5">
              <span aria-hidden className="size-2 shrink-0 rounded-full bg-primary" />
              {t("hero.actual", { percent })}
            </li>
            <li className="inline-flex items-center gap-1.5">
              <span aria-hidden className="h-3 w-1 shrink-0 rounded-full bg-success" />
              {t("hero.plan", { percent: planPercent })}
            </li>
          </ul>
        )}
      </div>

      {goal.status === "active" ? <GoalHeroPlanGap goal={goal} /> : null}
    </div>
  );
}

function GoalHeroPlanGap({ goal }: GoalProgressHeroProps) {
  const t = useTranslations("goals.detail.hero");
  const tPace = useTranslations("goals.pace");
  const gap = resolveGoalPlanGap(goal);

  function gapText(planGap: GoalPlanGap): string {
    const expected = roundToTenth(goal.expectedCompletedCount);

    switch (planGap.kind) {
      case "ahead":
        return t("gap.ahead", { count: planGap.books, expected });
      case "behind":
        return t("gap.behind", { count: planGap.books, expected });
      case "close_behind":
        return t("gap.closeBehind", { count: planGap.books, expected });
      case "on_plan":
        return t("gap.onPlan", { expected });
      default:
        return assertNever(planGap.kind);
    }
  }

  if (gap === null) return null;

  return (
    <div className="flex flex-col items-start gap-1.5 border-t border-border pt-3 sm:flex-row sm:items-center sm:gap-3">
      <Badge className="h-5 shrink-0 px-2.5 sm:h-6" variant={GOAL_SIGNAL_TONE.pace[gap.pace]}>
        {gap.kind === "close_behind" ? t("closeToPlan") : tPace(gap.pace)}
      </Badge>
      <p className="text-sm text-foreground">{gapText(gap)}</p>
    </div>
  );
}

function GoalHeroTimeNoteView({ goal }: GoalProgressHeroProps) {
  const t = useTranslations("goals.detail.hero");
  const locale = useLocale();
  const timeZone = useProfileTimeZone();
  const note = timeNote();

  function timeNote(): Nullable<GoalHeroTimeNote> {
    const { archivedAt, completedAt, daysLeft } = goal;

    switch (goal.status) {
      case "active":
        if (daysLeft === null) return null;
        if (daysLeft < 0)
          return { caption: null, text: t("overdue", { count: Math.abs(daysLeft) }) };
        return {
          caption: t("elapsed", { elapsed: goal.elapsedDays, total: goal.totalDays }),
          text: t("daysLeft", { count: daysLeft }),
        };
      case "archived":
        return {
          caption: null,
          text:
            archivedAt === null
              ? t("archived")
              : t("archivedOn", {
                  date: formatDateLong(instantToIsoDay({ instant: archivedAt, timeZone }), locale),
                }),
        };
      case "completed":
        return {
          caption: null,
          text:
            completedAt === null
              ? t("completed")
              : t("completedOn", { date: formatDateLong(completedAt, locale) }),
        };
      case "expired":
        return {
          caption: null,
          text:
            daysLeft !== null && daysLeft < 0
              ? t("overdue", { count: Math.abs(daysLeft) })
              : t("expired"),
        };
      default:
        return assertNever(goal.status);
    }
  }

  if (note === null) return null;

  const look = GOAL_HERO_LOOK[goal.status];

  return (
    <div className="flex min-w-0 items-center gap-2 sm:ml-auto sm:gap-2.5">
      <UiIcon className={cn("size-4 sm:size-5.5", look.tone)} name={look.icon} size={22} />
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 sm:flex-col sm:items-stretch sm:gap-0.5">
        <p className="text-sm font-semibold text-ink tabular-nums sm:font-heading sm:text-lg sm:leading-tight">
          {note.text}
        </p>
        {note.caption === null ? null : (
          <p className="text-xs text-muted-foreground tabular-nums">{note.caption}</p>
        )}
      </div>
    </div>
  );
}
