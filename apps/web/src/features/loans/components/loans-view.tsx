"use client";

import type { LoanListItemView, LoanType } from "@app/shared";

import { useTranslations } from "next-intl";
import { useState } from "react";

import type { EmptyStateEntry } from "@/lib/empty-states";

import { EmptyState } from "@/components/empty-state";
import { UiIcon } from "@/components/icons";
import { TitleLeaf } from "@/components/title-leaf";
import { Button } from "@/components/ui/button";
import { todayIso } from "@/features/books/model/reading-progress";
import { useRouter } from "@/i18n/navigation";

import type { LoanDirection } from "../model/loan-pages";

import { useLoansList } from "../api/use-loans-list";
import { useLoansSummary } from "../api/use-loans-summary";
import { LOAN_PAGES } from "../model/loan-pages";
import { nearestReturns } from "../model/loans-derive";
import { useLoansQuery } from "../model/use-loans-query";
import { EditLoanDialog } from "./edit-loan-dialog";
import { LoanRow } from "./loan-row";
import { LoansOverviewPanel } from "./loans-overview-panel";
import { LoansSidebar } from "./loans-sidebar";
import { LoansListSkeleton } from "./loans-skeleton";
import { LoansSummaryCards, useLoansSummaryCards } from "./loans-summary-cards";
import { LoansToolbar } from "./loans-toolbar";
import { ReturnLoanDialog } from "./return-loan-dialog";

type LoansContentProps = {
  direction: LoanDirection;
  hasActiveFilters: boolean;
  hasActiveSearch: boolean;
  isError: boolean;
  isPending: boolean;
  items: LoanListItemView[];
  onAddBook: () => void;
  onClearFilters: () => void;
  onEdit: (loan: LoanListItemView) => void;
  onOpenLibrary: () => void;
  onOpenOtherPage: () => void;
  onRetry: () => void;
  onReturn: (loan: LoanListItemView) => void;
  otherTypeCount: number;
  today: string;
};

export function LoansView({ type }: { type: LoanType }) {
  const page = LOAN_PAGES[type];
  const t = useTranslations("loans");
  const router = useRouter();
  const query = useLoansQuery(type);
  const summary = useLoansSummary();
  const list = useLoansList(query.listParams);

  const [editTarget, setEditTarget] = useState<LoanListItemView | null>(null);
  const [returnTarget, setReturnTarget] = useState<LoanListItemView | null>(null);

  const listPage = list.data;
  const items = listPage?.items ?? [];
  const today = todayIso();
  const nearest = nearestReturns(items, today);

  const summaryCards = useLoansSummaryCards(summary.data, type);

  const activeOfThisType = summary.data?.[page.direction].totalCount ?? 0;
  const activeOfOtherType = summary.data?.[LOAN_PAGES[page.otherType].direction].totalCount ?? 0;
  const hasAnyLoans = activeOfThisType + activeOfOtherType > 0 || items.length > 0;
  const showChrome = !list.isError && (list.isPending || hasAnyLoans);
  const showSummaryCards = summary.isPending || summary.isError || activeOfThisType > 0;

  const loansContent = (
    <LoansContent
      direction={page.direction}
      hasActiveFilters={query.hasActiveFilters}
      hasActiveSearch={query.hasActiveSearch}
      isError={list.isError}
      isPending={list.isPending}
      items={items}
      onAddBook={() => router.push("/books/new")}
      onClearFilters={query.clearFilters}
      onEdit={setEditTarget}
      onOpenLibrary={() => router.push("/books")}
      onOpenOtherPage={() => router.push(LOAN_PAGES[page.otherType].href)}
      onRetry={() => void list.refetch()}
      onReturn={setReturnTarget}
      otherTypeCount={activeOfOtherType}
      today={today}
    />
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-6 motion-safe:animate-in motion-safe:duration-500 motion-safe:fill-mode-both motion-safe:fade-in motion-safe:slide-in-from-bottom-1">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-heading text-[clamp(1.75rem,3.5vw,2.5rem)] leading-tight font-semibold text-ink">
              {t(`pages.${page.direction}.title`)}
            </h1>
            <TitleLeaf />
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
            {t(`pages.${page.direction}.subtitle`)}
          </p>
        </div>

        {showSummaryCards ? (
          <LoansSummaryCards
            cards={summaryCards}
            isError={summary.isError}
            isLoading={summary.isPending}
            mobileAction={
              <LoansOverviewPanel
                isLoading={list.isPending}
                nearest={nearest}
                onAddBook={() => router.push("/books/new")}
                summaryCards={summaryCards}
              />
            }
            onRetry={() => void summary.refetch()}
          />
        ) : null}
      </header>

      {showChrome ? (
        <div className="flex flex-col gap-4">
          <LoansToolbar
            filter={query.filter}
            onFilterChange={query.setFilter}
            onSearchChange={query.setSearch}
            onSearchClear={() => query.setSearch("")}
            onSortChange={query.setSort}
            search={query.state.q}
            sort={query.sort}
          />

          <div className="mt-2 flex flex-col gap-8 xl:flex-row xl:items-start xl:gap-6">
            <div className="flex min-w-0 flex-1 flex-col gap-6">
              <p className="sr-only" role="status">
                {list.isPending
                  ? ""
                  : t("resultsCount", { count: listPage?.totalCount ?? items.length })}
              </p>
              {loansContent}

              {listPage && items.length > 0 && listPage.pagesCount > 1 ? (
                <LoansPager
                  currentPage={listPage.page}
                  isFetching={list.isFetching}
                  onPageChange={query.setPage}
                  pagesCount={listPage.pagesCount}
                />
              ) : null}
            </div>

            <LoansSidebar
              isLoading={list.isPending}
              nearest={nearest}
              onAddBook={() => router.push("/books/new")}
            />
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-8 xl:flex-row xl:items-start xl:gap-6">
          <div className="flex min-w-0 flex-1 flex-col gap-6">{loansContent}</div>
        </div>
      )}

      {editTarget ? (
        <EditLoanDialog
          loan={editTarget}
          onOpenChange={(open) => {
            if (!open) setEditTarget(null);
          }}
          open
        />
      ) : null}

      {returnTarget ? (
        <ReturnLoanDialog
          loan={returnTarget}
          onOpenChange={(open) => {
            if (!open) setReturnTarget(null);
          }}
          open
        />
      ) : null}
    </div>
  );
}

function LoansContent({
  direction,
  hasActiveFilters,
  hasActiveSearch,
  isError,
  isPending,
  items,
  onAddBook,
  onClearFilters,
  onEdit,
  onOpenLibrary,
  onOpenOtherPage,
  onRetry,
  onReturn,
  otherTypeCount,
  today,
}: LoansContentProps) {
  const t = useTranslations("loans.states");
  const tLoans = useTranslations("loans");

  if (isError) {
    const errorState: EmptyStateEntry = {
      desc: t("error.description"),
      illu: "error-generic",
      primary: { icon: "refresh", label: t("error.retry") },
      title: t("error.title"),
    };
    return (
      <div aria-live="assertive" role="alert">
        <EmptyState onPrimary={onRetry} state={errorState} />
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
    if (hasActiveFilters || hasActiveSearch) {
      const noResults: EmptyStateEntry = {
        desc: t("noResults.description"),
        illu: "empty-search",
        primary: { icon: "x", label: t("noResults.clear") },
        title: t("noResults.title"),
      };
      return <EmptyState onPrimary={onClearFilters} state={noResults} />;
    }

    const typeEmpty: EmptyStateEntry = {
      desc: t(`typeEmpty.${direction}.description`),
      illu: "empty-borrowed",
      title: t(`typeEmpty.${direction}.title`),
    };

    if (otherTypeCount === 0) {
      return (
        <EmptyState
          onPrimary={onAddBook}
          onSecondary={onOpenLibrary}
          state={{
            ...typeEmpty,
            primary: { icon: "plus", label: t("empty.cta") },
            secondary: { icon: "book", label: t("empty.secondary") },
          }}
        />
      );
    }

    return (
      <EmptyState
        onPrimary={onOpenOtherPage}
        state={{
          ...typeEmpty,
          primary: { icon: "swap", label: t(`typeEmpty.${direction}.openOther`) },
        }}
      />
    );
  }

  return (
    <>
      <h2 className="sr-only">{tLoans(`pages.${direction}.listHeading`)}</h2>
      <ul className="flex flex-col gap-3">
        {items.map((loan) => (
          <li key={loan.id}>
            <LoanRow
              loan={loan}
              onEdit={() => onEdit(loan)}
              onReturn={() => onReturn(loan)}
              today={today}
            />
          </li>
        ))}
      </ul>
    </>
  );
}

function LoansPager({
  currentPage,
  isFetching,
  onPageChange,
  pagesCount,
}: {
  currentPage: number;
  isFetching: boolean;
  onPageChange: (value: number) => void;
  pagesCount: number;
}) {
  const t = useTranslations("loans.pagination");

  return (
    <div className="flex items-center justify-center gap-3">
      <Button
        disabled={currentPage <= 1 || isFetching}
        onClick={() => onPageChange(currentPage - 1)}
        size="sm"
        variant="secondary"
      >
        <UiIcon name="chevron-left" size={16} />
        {t("previous")}
      </Button>
      <span className="text-sm text-muted-foreground tabular-nums">
        {t("status", { page: currentPage, total: pagesCount })}
      </span>
      <Button
        disabled={currentPage >= pagesCount || isFetching}
        onClick={() => onPageChange(currentPage + 1)}
        size="sm"
        variant="secondary"
      >
        {t("next")}
        <UiIcon name="chevron-right" size={16} />
      </Button>
    </div>
  );
}
