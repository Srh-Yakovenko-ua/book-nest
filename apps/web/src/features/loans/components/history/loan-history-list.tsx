"use client";

import type { LoanHistoryListItemView } from "@app/shared";
import type { Ref } from "react";

import { useTranslations } from "next-intl";

import type { EmptyStateEntry } from "@/lib/empty-states";

import { EmptyState } from "@/components/empty-state";
import { RefreshingRegion } from "@/components/refreshing-region";

import { LoansListSkeleton } from "../loans-skeleton";
import { LoanHistoryRow } from "./loan-history-row";

type LoanHistoryListProps = {
  hasQuery: boolean;
  isError: boolean;
  isPending: boolean;
  isRefreshing: boolean;
  items: LoanHistoryListItemView[];
  onClearFilters: () => void;
  onCorrectDate: (loanId: string) => void;
  onEditNote: (loanId: string) => void;
  onOpenActiveLoans: () => void;
  onOpenContact: (contactId: string) => void;
  onOpenDetails: (loanId: string) => void;
  onRetry: () => void;
  retryButtonRef: Ref<HTMLButtonElement>;
};

export function LoanHistoryList({
  hasQuery,
  isError,
  isPending,
  isRefreshing,
  items,
  onClearFilters,
  onCorrectDate,
  onEditNote,
  onOpenActiveLoans,
  onOpenContact,
  onOpenDetails,
  onRetry,
  retryButtonRef,
}: LoanHistoryListProps) {
  const t = useTranslations("loans.history.states");
  const tPage = useTranslations("loans.pages.history");

  if (isError) {
    const errorState: EmptyStateEntry = {
      desc: t("error.description"),
      illu: "error-generic",
      primary: { icon: "refresh", label: t("error.retry") },
      title: t("error.title"),
    };

    return (
      <div aria-live="assertive" role="alert">
        <EmptyState onPrimary={onRetry} primaryRef={retryButtonRef} state={errorState} />
      </div>
    );
  }

  if (isPending) {
    return (
      <>
        <span className="sr-only" role="status">
          {t("loading")}
        </span>
        <LoansListSkeleton />
      </>
    );
  }

  if (items.length === 0) {
    if (hasQuery) {
      const noResults: EmptyStateEntry = {
        desc: t("noResults.description"),
        illu: "empty-search",
        primary: { icon: "x", label: t("noResults.clear") },
        title: t("noResults.title"),
      };

      return (
        <RefreshingRegion isRefreshing={isRefreshing}>
          <EmptyState onPrimary={onClearFilters} state={noResults} />
        </RefreshingRegion>
      );
    }

    const empty: EmptyStateEntry = {
      desc: t("empty.description"),
      illu: "empty-borrowed",
      primary: { icon: "arrow-right", label: t("empty.cta") },
      title: t("empty.title"),
    };

    return <EmptyState onPrimary={onOpenActiveLoans} state={empty} />;
  }

  return (
    <>
      <h2 className="sr-only">{tPage("listHeading")}</h2>
      <RefreshingRegion isRefreshing={isRefreshing}>
        <ul className="flex flex-col gap-3">
          {items.map((loan) => (
            <li key={loan.id}>
              <LoanHistoryRow
                loan={loan}
                onCorrectDate={() => onCorrectDate(loan.id)}
                onEditNote={() => onEditNote(loan.id)}
                onOpenContact={() => onOpenContact(loan.loanContactId)}
                onOpenDetails={() => onOpenDetails(loan.id)}
              />
            </li>
          ))}
        </ul>
      </RefreshingRegion>
    </>
  );
}
