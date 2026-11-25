"use client";

import type { ReadingGoalsOverview } from "@app/shared";

import { useTranslations } from "next-intl";

import type { SummaryCard } from "@/components/catalog/summary-cards";

import { SummaryCards } from "@/components/catalog/summary-cards";
import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";

import { useGoalsOverview } from "../api/use-goals-overview";
import { GoalsOverviewHighlights } from "./goals-overview-highlights";

const GOALS_KPI_COUNT = 4;

export function GoalsOverview() {
  const t = useTranslations("goals.catalog.kpi");
  const tCommon = useTranslations("common");
  const { data, isError, isFetching, isPending, refetch } = useGoalsOverview();
  const cards = useGoalsKpiCards(data);

  if (isError && data === undefined) {
    return (
      <div
        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-card"
        role="alert"
      >
        <p className="text-sm text-error">{t("loadError")}</p>
        <Button disabled={isFetching} onClick={() => void refetch()} size="sm" variant="secondary">
          <UiIcon name="refresh" size={14} />
          {tCommon("retry")}
        </Button>
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-6">
      <h2 className="sr-only">{t("label")}</h2>
      <div className="flex flex-col gap-3">
        <SummaryCards cards={cards} isLoading={isPending} skeletonCount={GOALS_KPI_COUNT} />
        <p className="max-w-prose text-sm text-pretty text-muted-foreground">
          <span className="font-medium text-foreground">{t("successRateNoteLabel")}</span>{" "}
          <span>{t("successRateExplanation")}</span>
        </p>
      </div>
      {data === undefined ? null : (
        <GoalsOverviewHighlights attention={data.attention} bestResult={data.bestResult} />
      )}
    </section>
  );
}

function useGoalsKpiCards(overview: ReadingGoalsOverview | undefined): SummaryCard[] {
  const t = useTranslations("goals.catalog.kpi");

  if (overview === undefined) return [];

  const { active, completed, success } = overview;
  const hasFinishedGoals = success.finishedGoals > 0;

  return [
    { icon: "target", iconTone: "info", label: t("active"), value: active.total },
    { icon: "trophy", iconTone: "success", label: t("completed"), value: completed.total },
    {
      icon: "alert-triangle",
      iconTone: "favorite",
      label: t("needsAttention"),
      value: active.needsAttention,
    },
    {
      icon: "chart-increasing",
      iconTone: "primary",
      label: t("successRate"),
      microfact: (
        <span className="block text-balance">
          {hasFinishedGoals
            ? t("successRateDetail", {
                finished: success.finishedGoals,
                successful: success.successfulGoals,
              })
            : t("successRateEmpty")}
        </span>
      ),
      value: hasFinishedGoals ? `${Math.round(success.successRatePercent)}%` : "—",
    },
  ];
}
