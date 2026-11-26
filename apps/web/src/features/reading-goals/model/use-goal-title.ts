"use client";

import type { Nullable } from "@app/shared";

import { useTranslations } from "next-intl";

type GoalTitleSource = {
  name: Nullable<string>;
  targetCount: number;
};

export function useGoalTitle(): (goal: GoalTitleSource) => string {
  const t = useTranslations("goals");

  return ({ name, targetCount }) => name ?? t("fallbackTitle", { count: targetCount });
}
