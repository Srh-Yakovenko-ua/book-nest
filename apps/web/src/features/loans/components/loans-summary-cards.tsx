"use client";

import type { LoanDirectionStats, LoansSummaryView, LoanType } from "@app/shared";
import type { ReactNode } from "react";

import { LOAN_STATS_WINDOWS } from "@app/shared";
import { useTranslations } from "next-intl";

import type { LibrarySummaryCard } from "@/features/books/components/library-summary-cards";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LibrarySummaryCards } from "@/features/books/components/library-summary-cards";
import { todayIso } from "@/features/books/model/reading-progress";

import type { LoanDirection } from "../model/loan-pages";

import { LOAN_PAGES } from "../model/loan-pages";
import { daysBetweenLoanDates } from "../model/loans-derive";

type LoansSummaryCardsProps = {
  cards: LibrarySummaryCard[];
  isError: boolean;
  isLoading: boolean;
  mobileAction?: ReactNode;
  onRetry: () => void;
};

type StatsCardKey =
  | "borrowed.longHeld"
  | "lent.noReturnDate"
  | "overdue"
  | "returningSoon"
  | `${LoanDirection}.total`;

const TOTAL_CARD_LOOK = {
  borrowed: { icon: "arrow-down-circle", iconTone: "info" },
  lent: { icon: "arrow-up-right", iconTone: "primary" },
} as const satisfies Record<LoanDirection, Pick<LibrarySummaryCard, "icon" | "iconTone">>;

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
  const { direction } = LOAN_PAGES[type];

  return useDirectionCards(summary?.[direction], direction);
}

function useDirectionCards(
  stats: LoanDirectionStats | undefined,
  direction: LoanDirection,
): LibrarySummaryCard[] {
  const t = useTranslations("loans.stats");
  const today = todayIso();

  const mobileLabels = (key: StatsCardKey) => ({
    compact: t(`${key}.mobile.compact`),
    detailed: t(`${key}.mobile.detailed`),
  });

  const totalCount = stats?.totalCount ?? 0;
  const returningSoonCount = stats?.returningSoonCount ?? 0;
  const daysUntilNearestReturn = daysBetweenLoanDates(today, stats?.nearestReturnDate ?? null);
  const daysSinceOldestOverdue = daysBetweenLoanDates(
    stats?.oldestOverdueReturnDate ?? null,
    today,
  );
  const daysSinceEarliestLoan = daysBetweenLoanDates(stats?.earliestLoanDate ?? null, today);

  function nearestReturnMicrofact(): string {
    if (returningSoonCount === 0 || daysUntilNearestReturn === null) {
      return t("returningSoon.empty", { days: LOAN_STATS_WINDOWS.returnSoonDays });
    }
    if (daysUntilNearestReturn <= 0) return t("returningSoon.today");
    if (daysUntilNearestReturn === 1) return t("returningSoon.tomorrow");
    return t("returningSoon.inDays", { count: daysUntilNearestReturn });
  }

  const trailingCard: LibrarySummaryCard =
    direction === "borrowed"
      ? {
          icon: "clock",
          iconTone: "ink",
          label: t("borrowed.longHeld.label"),
          microfact:
            (stats?.longHeldCount ?? 0) === 0 || daysSinceEarliestLoan === null
              ? t("borrowed.longHeld.empty", { days: LOAN_STATS_WINDOWS.longHeldDays })
              : t("borrowed.longHeld.longest", { count: daysSinceEarliestLoan }),
          mobileLabels: mobileLabels("borrowed.longHeld"),
          value: stats?.longHeldCount ?? 0,
        }
      : {
          icon: "circle-slash",
          iconTone: "ink",
          label: t("lent.noReturnDate.label"),
          microfact:
            (stats?.noReturnDateCount ?? 0) === 0
              ? t("lent.noReturnDate.empty")
              : t("lent.noReturnDate.people", { count: stats?.noReturnDatePeopleCount ?? 0 }),
          mobileLabels: mobileLabels("lent.noReturnDate"),
          value: stats?.noReturnDateCount ?? 0,
        };

  return [
    {
      ...TOTAL_CARD_LOOK[direction],
      label: t(`${direction}.total.label`),
      microfact:
        totalCount === 0
          ? t(`${direction}.total.empty`)
          : t(`${direction}.total.people`, { count: stats?.peopleCount ?? 0 }),
      mobileLabels: mobileLabels(`${direction}.total`),
      unit: t("unit", { count: totalCount }),
      value: totalCount,
    },
    {
      icon: "calendar",
      iconTone: "success",
      label: t("returningSoon.label"),
      microfact: nearestReturnMicrofact(),
      mobileLabels: mobileLabels("returningSoon"),
      value: returningSoonCount,
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
    trailingCard,
  ];
}
