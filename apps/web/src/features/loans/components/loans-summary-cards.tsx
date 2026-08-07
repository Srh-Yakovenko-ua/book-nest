"use client";

import type { LoansSummaryView } from "@app/shared";
import type { ReactNode } from "react";

import { useTranslations } from "next-intl";

import type { LibrarySummaryCard } from "@/features/books/components/library-summary-cards";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LibrarySummaryCards } from "@/features/books/components/library-summary-cards";

type LoansSummaryCardsProps = {
  cards: LibrarySummaryCard[];
  isError: boolean;
  isLoading: boolean;
  mobileAction?: ReactNode;
  onRetry: () => void;
};

export function LoansSummaryCards({
  cards,
  isError,
  isLoading,
  mobileAction,
  onRetry,
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

  return (
    <LibrarySummaryCards
      cards={cards}
      isLoading={isLoading}
      mobileAction={mobileAction}
      mobileLayout="compact"
    />
  );
}

export function useLoansSummaryCards(summary: LoansSummaryView | undefined): LibrarySummaryCard[] {
  const t = useTranslations("loans.summary");

  const mobileLabels = (key: "borrowed" | "lent" | "overdue" | "returnThisWeek") => ({
    compact: t(`mobile.compact.${key}`),
    detailed: t(`mobile.detailed.${key}`),
  });

  return [
    {
      icon: "arrow-down-circle",
      iconTone: "info",
      label: t("borrowed"),
      mobileLabels: mobileLabels("borrowed"),
      value: summary?.borrowedCount ?? 0,
    },
    {
      icon: "arrow-up-right",
      iconTone: "primary",
      label: t("lent"),
      mobileLabels: mobileLabels("lent"),
      value: summary?.lentCount ?? 0,
    },
    {
      icon: "calendar",
      iconTone: "success",
      label: t("returnThisWeek"),
      mobileLabels: mobileLabels("returnThisWeek"),
      value: summary?.returnThisWeek ?? 0,
    },
    {
      icon: "alert-triangle",
      iconTone: "favorite",
      label: t("overdue"),
      mobileLabels: mobileLabels("overdue"),
      value: summary?.overdueCount ?? 0,
    },
  ];
}
