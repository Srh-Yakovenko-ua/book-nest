"use client";

import type { BorrowedLoansStats, LoansSummaryView, LoanType } from "@app/shared";
import type { ReactNode } from "react";

import { LOAN_STATS_WINDOWS } from "@app/shared";
import { useTranslations } from "next-intl";

import type { LibrarySummaryCard } from "@/features/books/components/library-summary-cards";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LibrarySummaryCards } from "@/features/books/components/library-summary-cards";
import { todayIso } from "@/features/books/model/reading-progress";

import { daysBetweenLoanDates } from "../model/loans-derive";

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

export function useLoansSummaryCards(
  summary: LoansSummaryView | undefined,
  type: LoanType,
): LibrarySummaryCard[] {
  const overviewCards = useOverviewCards(summary);
  const borrowedCards = useBorrowedCards(summary?.borrowed, summary?.borrowedCount ?? 0);

  return type === "borrowed_from_someone" ? borrowedCards : overviewCards;
}

function useBorrowedCards(
  stats: BorrowedLoansStats | undefined,
  borrowedCount: number,
): LibrarySummaryCard[] {
  const t = useTranslations("loans.borrowedStats");
  const today = todayIso();

  const mobileLabels = (key: "longHeld" | "overdue" | "returningSoon" | "total") => ({
    compact: t(`${key}.mobile.compact`),
    detailed: t(`${key}.mobile.detailed`),
  });

  const daysUntilNearestReturn = daysBetweenLoanDates(today, stats?.nearestReturnDate ?? null);
  const daysSinceOldestOverdue = daysBetweenLoanDates(
    stats?.oldestOverdueReturnDate ?? null,
    today,
  );
  const daysSinceEarliestLoan = daysBetweenLoanDates(stats?.earliestLoanDate ?? null, today);

  function nearestReturnMicrofact(): string {
    if ((stats?.returningSoonCount ?? 0) === 0 || daysUntilNearestReturn === null) {
      return t("returningSoon.empty", { days: LOAN_STATS_WINDOWS.returnSoonDays });
    }
    if (daysUntilNearestReturn <= 0) return t("returningSoon.today");
    if (daysUntilNearestReturn === 1) return t("returningSoon.tomorrow");
    return t("returningSoon.inDays", { count: daysUntilNearestReturn });
  }

  return [
    {
      icon: "arrow-down-circle",
      iconTone: "info",
      label: t("total.label"),
      microfact:
        borrowedCount === 0
          ? t("total.empty")
          : t("total.people", { count: stats?.peopleCount ?? 0 }),
      mobileLabels: mobileLabels("total"),
      unit: t("total.unit", { count: borrowedCount }),
      value: borrowedCount,
    },
    {
      icon: "calendar",
      iconTone: "success",
      label: t("returningSoon.label"),
      microfact: nearestReturnMicrofact(),
      mobileLabels: mobileLabels("returningSoon"),
      value: stats?.returningSoonCount ?? 0,
    },
    {
      icon: "alert-triangle",
      iconTone: "favorite",
      label: t("overdue.label"),
      microfact:
        daysSinceOldestOverdue === null
          ? t("overdue.empty")
          : t("overdue.longest", { count: daysSinceOldestOverdue }),
      mobileLabels: mobileLabels("overdue"),
      value: stats?.overdueCount ?? 0,
    },
    {
      icon: "clock",
      iconTone: "ink",
      label: t("longHeld.label"),
      microfact:
        (stats?.longHeldCount ?? 0) === 0 || daysSinceEarliestLoan === null
          ? t("longHeld.empty", { days: LOAN_STATS_WINDOWS.longHeldDays })
          : t("longHeld.longest", { count: daysSinceEarliestLoan }),
      mobileLabels: mobileLabels("longHeld"),
      value: stats?.longHeldCount ?? 0,
    },
  ];
}

function useOverviewCards(summary: LoansSummaryView | undefined): LibrarySummaryCard[] {
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
