"use client";

import type { LoansSummaryView } from "@app/shared";

import { useTranslations } from "next-intl";

import type { UiIconName } from "@/components/icons";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";

type LoansSummaryCardsProps = {
  isError: boolean;
  isLoading: boolean;
  onRetry: () => void;
  summary: LoansSummaryView | undefined;
};

export function LoansSummaryCards({
  isError,
  isLoading,
  onRetry,
  summary,
}: LoansSummaryCardsProps) {
  const t = useTranslations("loans.summary");

  if (isError) {
    return (
      <Card
        aria-live="assertive"
        className="flex flex-col items-start gap-2 border border-border bg-card p-4 shadow-card sm:flex-row sm:items-center sm:justify-between"
        role="alert"
      >
        <p className="text-sm text-muted-foreground">{t("error.description")}</p>
        <Button onClick={onRetry} size="sm" variant="secondary">
          <UiIcon name="refresh" size={16} />
          {t("error.retry")}
        </Button>
      </Card>
    );
  }

  const cards: { icon: UiIconName; label: string; value: number }[] = [
    { icon: "arrow-down-circle", label: t("borrowed"), value: summary?.borrowedCount ?? 0 },
    { icon: "arrow-up-right", label: t("lent"), value: summary?.lentCount ?? 0 },
    { icon: "calendar", label: t("returnThisWeek"), value: summary?.returnThisWeek ?? 0 },
    { icon: "alert-triangle", label: t("overdue"), value: summary?.overdueCount ?? 0 },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      {isLoading
        ? Array.from({ length: cards.length }, (_, index) => <SummaryCardSkeleton key={index} />)
        : cards.map((card) => (
            <StatCard
              icon={card.icon}
              key={card.label}
              label={card.label}
              size="compact"
              value={card.value.toLocaleString()}
            />
          ))}
    </div>
  );
}

function SummaryCardSkeleton() {
  return (
    <Card className="flex flex-row items-center gap-2.5 border border-border bg-card px-3 py-3 shadow-card sm:gap-3 sm:px-4 sm:py-3.5">
      <Skeleton className="size-10 shrink-0 rounded-full sm:size-11" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Skeleton className="h-3.5 w-20" />
        <Skeleton className="h-6 w-12" />
      </div>
    </Card>
  );
}
