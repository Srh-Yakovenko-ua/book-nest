"use client";

import type { LoanListItemView } from "@app/shared";

import { useTranslations } from "next-intl";
import { useState } from "react";

import type { EmptyStateEntry } from "@/lib/empty-states";

import { EmptyState } from "@/components/empty-state";
import { UiIcon } from "@/components/icons";
import { TitleLeaf } from "@/components/title-leaf";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { todayIso } from "@/features/books/model/reading-progress";
import { useRouter } from "@/i18n/navigation";
import { LoansControllerListType } from "@/shared/api/generated/model";

import { useLoansList } from "../api/use-loans-list";
import { useLoansSummary } from "../api/use-loans-summary";
import { nearestReturns } from "../model/loans-derive";
import { useLoansQuery } from "../model/use-loans-query";
import { EditLoanDialog } from "./edit-loan-dialog";
import { LoanRow } from "./loan-row";
import { LoansSidebar } from "./loans-sidebar";
import { LoansListSkeleton } from "./loans-skeleton";
import { LoansSummaryCards } from "./loans-summary-cards";
import { LoansToolbar } from "./loans-toolbar";
import { ReturnLoanDialog } from "./return-loan-dialog";

type LoansContentProps = {
  hasActiveFilters: boolean;
  hasActiveSearch: boolean;
  isError: boolean;
  isPending: boolean;
  items: LoanListItemView[];
  onAddBook: () => void;
  onClearFilters: () => void;
  onEdit: (loan: LoanListItemView) => void;
  onOpenLibrary: () => void;
  onRetry: () => void;
  onReturn: (loan: LoanListItemView) => void;
  onSwitchTab: (value: LoansControllerListType) => void;
  tab: LoansControllerListType;
  today: string;
  totalActive: number;
};

export function LoansView() {
  const t = useTranslations("loans");
  const router = useRouter();
  const query = useLoansQuery();
  const summary = useLoansSummary();
  const list = useLoansList(query.listParams);

  const [editTarget, setEditTarget] = useState<LoanListItemView | null>(null);
  const [returnTarget, setReturnTarget] = useState<LoanListItemView | null>(null);

  const page = list.data;
  const items = page?.items ?? [];
  const today = todayIso();
  const nearest = nearestReturns(items, today);

  const borrowedCount = summary.data?.borrowedCount ?? 0;
  const lentCount = summary.data?.lentCount ?? 0;
  const totalActive = borrowedCount + lentCount;
  const hasAnyLoans = totalActive > 0 || items.length > 0;
  const showChrome = !list.isError && (list.isPending || hasAnyLoans);

  const loansContent = (
    <LoansContent
      hasActiveFilters={query.hasActiveFilters}
      hasActiveSearch={query.hasActiveSearch}
      isError={list.isError}
      isPending={list.isPending}
      items={items}
      onAddBook={() => router.push("/books/new")}
      onClearFilters={query.clearFilters}
      onEdit={setEditTarget}
      onOpenLibrary={() => router.push("/books")}
      onRetry={() => void list.refetch()}
      onReturn={setReturnTarget}
      onSwitchTab={query.setTab}
      tab={query.tab}
      today={today}
      totalActive={totalActive}
    />
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-6 motion-safe:animate-in motion-safe:duration-500 motion-safe:fill-mode-both motion-safe:fade-in motion-safe:slide-in-from-bottom-1">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-heading text-[clamp(1.75rem,3.5vw,2.5rem)] leading-tight font-semibold text-ink">
              {t("title")}
            </h1>
            <TitleLeaf />
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground md:text-base">{t("subtitle")}</p>
        </div>

        <LoansSummaryCards
          isError={summary.isError}
          isLoading={summary.isPending}
          onRetry={() => void summary.refetch()}
          summary={summary.data}
        />
      </header>

      {showChrome ? (
        <Tabs
          className="gap-6"
          onValueChange={(value) => query.setTab(value as LoansControllerListType)}
          value={query.tab}
        >
          <div className="flex flex-col gap-4">
            <TabsList>
              <TabsTrigger value={LoansControllerListType.borrowed_from_someone}>
                {t("tabs.borrowed")}
                <Badge variant="secondary">{borrowedCount}</Badge>
              </TabsTrigger>
              <TabsTrigger value={LoansControllerListType.lent_to_someone}>
                {t("tabs.lent")}
                <Badge variant="secondary">{lentCount}</Badge>
              </TabsTrigger>
            </TabsList>

            <LoansToolbar
              filter={query.filter}
              onFilterChange={query.setFilter}
              onSearchChange={query.setSearch}
              onSearchClear={() => query.setSearch("")}
              onSortChange={query.setSort}
              search={query.state.q}
              sort={query.sort}
            />
          </div>

          <div className="flex flex-col gap-8 xl:flex-row xl:items-start xl:gap-6">
            <div className="flex min-w-0 flex-1 flex-col gap-6">
              <TabsContent className="mt-0 flex flex-col gap-6 outline-none" value={query.tab}>
                <p className="sr-only" role="status">
                  {list.isPending
                    ? ""
                    : t("resultsCount", { count: page?.totalCount ?? items.length })}
                </p>
                {loansContent}
              </TabsContent>

              {page && items.length > 0 && page.pagesCount > 1 ? (
                <LoansPager
                  currentPage={page.page}
                  isFetching={list.isFetching}
                  onPageChange={query.setPage}
                  pagesCount={page.pagesCount}
                />
              ) : null}
            </div>

            <LoansSidebar
              isLoading={list.isPending}
              nearest={nearest}
              onAddBook={() => router.push("/books/new")}
            />
          </div>
        </Tabs>
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
  hasActiveFilters,
  hasActiveSearch,
  isError,
  isPending,
  items,
  onAddBook,
  onClearFilters,
  onEdit,
  onOpenLibrary,
  onRetry,
  onReturn,
  onSwitchTab,
  tab,
  today,
  totalActive,
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

    if (totalActive === 0) {
      const emptyState: EmptyStateEntry = {
        desc: t("empty.description"),
        illu: "empty-borrowed",
        primary: { icon: "plus", label: t("empty.cta") },
        secondary: { icon: "book", label: t("empty.secondary") },
        title: t("empty.title"),
      };
      return <EmptyState onPrimary={onAddBook} onSecondary={onOpenLibrary} state={emptyState} />;
    }

    const isBorrowed = tab === LoansControllerListType.borrowed_from_someone;
    const otherTab = isBorrowed
      ? LoansControllerListType.lent_to_someone
      : LoansControllerListType.borrowed_from_someone;
    const tabEmpty: EmptyStateEntry = {
      desc: t("tabEmpty.description"),
      illu: "empty-borrowed",
      primary: {
        icon: "swap",
        label: isBorrowed ? t("tabEmpty.switchToLent") : t("tabEmpty.switchToBorrowed"),
      },
      title: isBorrowed ? t("tabEmpty.titleBorrowed") : t("tabEmpty.titleLent"),
    };
    return <EmptyState onPrimary={() => onSwitchTab(otherTab)} state={tabEmpty} />;
  }

  return (
    <>
      <h2 className="sr-only">{tLoans("listHeading")}</h2>
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
