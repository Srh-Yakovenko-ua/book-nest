"use client";

import type { Nullable, ReadingGoalView } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";

import { formatDateLong } from "@/lib/format";

type GoalTimeNoteInput = Pick<ReadingGoalView, "completedAt" | "daysLeft" | "status">;

export function useGoalTimeNote(goal: GoalTimeNoteInput): Nullable<string> {
  const t = useTranslations("goals.detail");
  const locale = useLocale();

  if (goal.completedAt !== null) {
    return t("completedOn", { date: formatDateLong(goal.completedAt, locale) });
  }
  if (goal.status === "archived" || goal.daysLeft === null) return null;
  if (goal.daysLeft < 0) return t("daysOverdue", { count: Math.abs(goal.daysLeft) });
  return t("daysLeft", { count: goal.daysLeft });
}
