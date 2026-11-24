"use client";

import type { ReadingGoalActivityView } from "@app/shared";

import { useTranslations } from "next-intl";
import { useId } from "react";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";

import { GoalActivityRow } from "./goal-activity-row";

type GoalActivityPreviewProps = {
  items: ReadingGoalActivityView[];
  onShowAll: () => void;
};

const GOAL_ACTIVITY_PREVIEW = {
  limit: 3,
} as const satisfies Record<string, number>;

export function GoalActivityPreview({ items, onShowAll }: GoalActivityPreviewProps) {
  const t = useTranslations("goals.detail.overview.recentActivity");
  const headingId = useId();
  const hasItems = items.length > 0;

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-heading text-lg font-semibold text-ink" id={headingId}>
          {t("title")}
        </h2>
        {hasItems ? (
          <Button onClick={onShowAll} size="sm" variant="ghost">
            {t("showAll")}
            <UiIcon aria-hidden name="arrow-right" size={14} />
          </Button>
        ) : null}
      </div>
      {hasItems ? (
        <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
          {items.slice(0, GOAL_ACTIVITY_PREVIEW.limit).map((item) => (
            <GoalActivityRow item={item} key={item.id} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      )}
    </section>
  );
}
