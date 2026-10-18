"use client";

import type { ReadingGoalActivityView } from "@app/shared";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";

import { GoalActivityRow } from "./goal-activity-row";

type GoalActivityPreviewProps = {
  items: ReadingGoalActivityView[];
  onShowAll: () => void;
};

export function GoalActivityPreview({ items, onShowAll }: GoalActivityPreviewProps) {
  const t = useTranslations("goals.detail.overview.recentActivity");

  if (items.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-heading text-base font-semibold text-ink">{t("title")}</h2>
        <Button onClick={onShowAll} size="sm" variant="ghost">
          {t("showAll")}
          <UiIcon aria-hidden name="arrow-right" size={14} />
        </Button>
      </div>
      <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
        {items.map((item) => (
          <GoalActivityRow item={item} key={item.id} />
        ))}
      </ul>
    </section>
  );
}
