"use client";

import type { Nullable } from "@app/shared";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { TitleLeaf } from "@/components/title-leaf";
import { Button } from "@/components/ui/button";

import type { LoanHistoryCorrectionMode } from "./loan-history-correction-dialog";

import { useLoanHistory } from "../../api/use-loan-history";
import { useLoanHistoryOverview } from "../../api/use-loan-history-overview";
import { restoreFocusTo, restoreLoanTriggerFocus } from "../../model/loan-focus";
import { useLoanContactDrawer } from "../../model/use-loan-contact-drawer";
import { useLoanHistoryQuery } from "../../model/use-loan-history-query";
import { LoanContactDrawer } from "../contact/loan-contact-drawer";
import { LoanHistoryCorrectionDialog } from "./loan-history-correction-dialog";
import { LoanHistoryDetailDrawer } from "./loan-history-detail-drawer";
import { LoanHistoryList } from "./loan-history-list";
import { LoanHistoryOverviewPanel, LoanHistorySidebar } from "./loan-history-sidebar";
import { LoanHistorySummaryCards, useLoanHistorySummaryCards } from "./loan-history-summary-cards";
import { LoanHistoryToolbar } from "./loan-history-toolbar";

type LoanHistoryCorrection = {
  loanId: string;
  mode: LoanHistoryCorrectionMode;
  origin: "detail" | "row";
};

export function LoanHistoryView() {
  const t = useTranslations("loans.history");
  const tPage = useTranslations("loans.pages.history");

  const query = useLoanHistoryQuery();
  const overview = useLoanHistoryOverview(query.overviewParams);
  const list = useLoanHistory(query.listParams);

  const [detailLoanId, setDetailLoanId] = useState<Nullable<string>>(null);
  const [correction, setCorrection] = useState<Nullable<LoanHistoryCorrection>>(null);
  const detailActionRef = useRef<Nullable<HTMLElement>>(null);
  const contactDrawer = useLoanContactDrawer();

  function correctFromDetail(mode: LoanHistoryCorrectionMode) {
    if (detailLoanId === null) return;
    const opener = document.activeElement;
    detailActionRef.current = opener instanceof HTMLElement ? opener : null;
    setCorrection({ loanId: detailLoanId, mode, origin: "detail" });
  }

  const loadedPages = list.data?.pages ?? [];
  const items = loadedPages.flatMap((page) => page.items);
  const totalCount = loadedPages[0]?.totalCount ?? items.length;

  const summaryCards = useLoanHistorySummaryCards(overview.data);
  const hasQuery = query.hasActiveFilters || query.hasActiveSearch;
  const isHistoryEmpty = !list.isPending && !list.isError && items.length === 0 && !hasQuery;
  const showChrome = !list.isError && !isHistoryEmpty;

  const analytics = {
    activeContactId: query.contactId,
    isLoading: overview.isPending,
    onPersonOpen: contactDrawer.openContact,
    onPersonSelect: (contactId: string) =>
      query.setContactId(contactId === query.contactId ? "" : contactId),
    overview: overview.data,
  };

  const content = (
    <LoanHistoryList
      hasQuery={hasQuery}
      isError={list.isError}
      isPending={list.isPending}
      items={items}
      onClearFilters={query.clearFilters}
      onCorrectDate={(loanId) => setCorrection({ loanId, mode: "date", origin: "row" })}
      onEditNote={(loanId) => setCorrection({ loanId, mode: "note", origin: "row" })}
      onOpenContact={contactDrawer.openContact}
      onOpenDetails={setDetailLoanId}
      onRetry={() => void list.refetch()}
    />
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-6 motion-safe:animate-in motion-safe:duration-500 motion-safe:fill-mode-both motion-safe:fade-in motion-safe:slide-in-from-bottom-1">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-heading text-[clamp(1.75rem,3.5vw,2.5rem)] leading-tight font-semibold text-ink">
              {tPage("title")}
            </h1>
            <TitleLeaf />
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
            {tPage("subtitle")}
          </p>
        </div>

        {showChrome ? (
          <LoanHistorySummaryCards
            cards={summaryCards}
            isError={overview.isError}
            isLoading={overview.isPending}
            mobileAction={<LoanHistoryOverviewPanel {...analytics} />}
            onRetry={() => void overview.refetch()}
          />
        ) : null}
      </header>

      {showChrome ? (
        <div className="flex flex-col gap-4">
          <LoanHistoryToolbar query={query} />

          <div className="mt-2 flex flex-col gap-8 xl:flex-row xl:items-start xl:gap-6">
            <div className="flex min-w-0 flex-1 flex-col gap-6">
              <p className="sr-only" role="status">
                {list.isPending ? "" : t("resultsCount", { count: totalCount })}
              </p>

              {content}

              {items.length > 0 && list.hasNextPage ? (
                <LoanHistoryLoadMore
                  isFetchingNextPage={list.isFetchingNextPage}
                  isLoadMoreError={list.isFetchNextPageError}
                  onLoadMore={() => void list.fetchNextPage()}
                />
              ) : null}
            </div>

            <LoanHistorySidebar {...analytics} />
          </div>
        </div>
      ) : (
        content
      )}

      <LoanContactDrawer {...contactDrawer.drawerProps} />

      <LoanHistoryDetailDrawer
        loanId={detailLoanId}
        onCorrectDate={() => correctFromDetail("date")}
        onEditNote={() => correctFromDetail("note")}
        onOpenChange={(open) => {
          if (!open) setDetailLoanId(null);
        }}
        open={detailLoanId !== null}
      />

      {correction === null ? null : (
        <LoanHistoryCorrectionDialog
          loanId={correction.loanId}
          mode={correction.mode}
          onCloseAutoFocus={(event) => {
            if (correction.origin === "detail") {
              restoreFocusTo(event, detailActionRef.current);
              return;
            }
            restoreLoanTriggerFocus(event, correction.loanId);
          }}
          onOpenChange={(open) => {
            if (!open) setCorrection(null);
          }}
          open
        />
      )}
    </div>
  );
}

function LoanHistoryLoadMore({
  isFetchingNextPage,
  isLoadMoreError,
  onLoadMore,
}: {
  isFetchingNextPage: boolean;
  isLoadMoreError: boolean;
  onLoadMore: () => void;
}) {
  const t = useTranslations("loans.history");

  return (
    <div className="flex flex-col items-center gap-2">
      {isLoadMoreError ? (
        <p className="text-sm text-error" role="alert">
          {t("loadMoreError")}
        </p>
      ) : null}
      <Button
        disabled={isFetchingNextPage}
        loading={isFetchingNextPage}
        onClick={onLoadMore}
        variant="secondary"
      >
        {t("loadMore")}
      </Button>
    </div>
  );
}
