"use client";

import type { ReadingGoalDetail } from "@app/shared";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { assertNever } from "@/lib/assert-never";

import type { GoalPrimaryAction } from "../model/goal-primary-action";

import { resolveGoalPaceAdvice, resolveGoalPaceBadge } from "../model/goal-pace-figures";
import { GOAL_SIGNAL_TONE } from "../model/goal-status";

type GoalHeroNextStepProps = {
  action: GoalPrimaryAction;
  goal: ReadingGoalDetail;
  onShowRemainingBooks: () => void;
};

type GoalHeroPaceBadgeProps = Pick<GoalHeroNextStepProps, "goal">;

type GoalHeroPrimaryActionProps = Omit<GoalHeroNextStepProps, "goal">;

export function GoalHeroNextStep({ action, goal, onShowRemainingBooks }: GoalHeroNextStepProps) {
  const t = useTranslations("goals.detail.hero");
  const tRate = useTranslations("goals.detail.overview.pace");
  const advice = resolveGoalPaceAdvice({
    booksPerDay: goal.requiredBooksPerDay,
    daysPerBook: goal.requiredDaysPerBook,
  });

  function adviceText(): string {
    switch (advice.kind) {
      case "books_per_day":
        return t("advice.booksPerDay", { count: advice.booksPerDay });
      case "days_per_book":
        return t("advice.daysPerBook", { count: advice.days });
      case "missing":
        return tRate("noData");
      default:
        return assertNever(advice);
    }
  }

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-3 sm:flex-row sm:items-center sm:gap-4">
      <div className="flex min-w-0 flex-1 flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:gap-3">
        <GoalHeroPaceBadge goal={goal} />
        <p className="text-sm text-foreground">{adviceText()}</p>
      </div>
      <GoalHeroPrimaryAction action={action} onShowRemainingBooks={onShowRemainingBooks} />
    </div>
  );
}

function GoalHeroPaceBadge({ goal }: GoalHeroPaceBadgeProps) {
  const t = useTranslations("goals.detail.hero");
  const tPace = useTranslations("goals.pace");
  const badge = resolveGoalPaceBadge(goal);

  if (badge === null) return null;

  const pace = badge.kind === "close_to_plan" ? "on_track" : badge.pace;

  return (
    <Badge className="h-5 shrink-0 px-2.5 sm:h-6" variant={GOAL_SIGNAL_TONE.pace[pace]}>
      {badge.kind === "close_to_plan" ? t("closeToPlan") : tPace(pace)}
    </Badge>
  );
}

function GoalHeroPrimaryAction({ action, onShowRemainingBooks }: GoalHeroPrimaryActionProps) {
  const t = useTranslations("goals.detail.hero.action");

  switch (action.kind) {
    case "books":
      return (
        <Button className="w-full sm:w-auto" onClick={onShowRemainingBooks} size="lg">
          <UiIcon name="list" size={16} />
          {t("books")}
        </Button>
      );
    case "continue":
      return (
        <Button asChild className="w-full sm:w-auto" size="lg">
          <Link href={`/books/${action.bookId}`}>
            <UiIcon name="book-open-text" size={16} />
            {t("continue")}
          </Link>
        </Button>
      );
    default:
      return assertNever(action);
  }
}
