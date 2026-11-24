"use client";

import type { ReadingGoalDetail } from "@app/shared";
import type { ReactNode } from "react";

import { useLocale, useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { formatDateLong } from "@/lib/format";

import { GOAL_STATUS_BADGE } from "../model/goal-status";
import { useGoalTitle } from "../model/use-goal-title";

type GoalDetailHeaderProps = {
  actions: ReactNode;
  goal: ReadingGoalDetail;
};

type GoalDetailPartProps = {
  goal: ReadingGoalDetail;
};

export function GoalDetailHeader({ actions, goal }: GoalDetailHeaderProps) {
  const goalTitle = useGoalTitle();

  return (
    <header className="flex flex-col gap-2 sm:gap-3">
      <div className="flex items-center justify-between gap-3">
        <GoalBackLink goal={goal} />
        {actions}
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="min-w-0 font-heading text-2xl font-semibold break-words text-ink sm:text-3xl">
            {goalTitle(goal)}
          </h1>
          <GoalStatusLabels goal={goal} />
        </div>
        <GoalMeta goal={goal} />
      </div>
    </header>
  );
}

function GoalBackLink({ goal }: GoalDetailPartProps) {
  const t = useTranslations("goals.detail");

  return (
    <Link
      className="inline-flex min-w-0 items-center gap-1.5 rounded-sm text-sm text-muted-foreground no-underline transition-colors outline-none hover:text-foreground focus-visible:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      href={goal.list === null ? "/goals" : `/lists/${goal.list.id}`}
    >
      <UiIcon aria-hidden className="shrink-0" name="arrow-left" size={16} />
      <span className="truncate">
        {goal.list === null ? t("backToGoals") : t("back", { name: goal.list.name })}
      </span>
    </Link>
  );
}

function GoalMeta({ goal }: GoalDetailPartProps) {
  const t = useTranslations("goals.detail.meta");
  const locale = useLocale();
  const { list } = goal;

  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
      <li className="inline-flex min-w-0 items-center gap-1.5">
        <UiIcon className="text-icon" name="calendar" size={16} />
        {t("deadline", { date: formatDateLong(goal.deadline, locale) })}
      </li>
      {list === null ? null : (
        <li className="inline-flex min-w-0 items-center gap-1.5">
          <UiIcon className="text-icon" name="list" size={16} />
          <span className="min-w-0 break-words">
            {t.rich("list", {
              link: (chunks) => (
                <Link
                  className="rounded-sm font-medium text-foreground underline underline-offset-4 outline-none hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50"
                  href={`/lists/${list.id}`}
                >
                  {chunks}
                </Link>
              ),
              name: list.name,
            })}
          </span>
        </li>
      )}
    </ul>
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
