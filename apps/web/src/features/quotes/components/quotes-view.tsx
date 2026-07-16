"use client";

import type { ReactNode } from "react";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { TitleLeaf } from "@/components/title-leaf";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "@/i18n/navigation";

import { useQuoteBook } from "../api/use-quote-book";
import { useQuotes } from "../api/use-quotes";
import { useQuotesSummary } from "../api/use-quotes-summary";
import { toQuoteBookOption } from "../model/quote-book";
import { quotesListIdentity } from "../model/quotes-query";
import { useQuotesQuery } from "../model/use-quotes-query";
import { QuoteDialog } from "./quote-dialog";
import { QuotesContent } from "./quotes-content";
import { QuotesSidebar } from "./quotes-sidebar";
import { QuotesToolbar, QuotesToolbarSkeleton } from "./quotes-toolbar";

export function QuotesView() {
  const t = useTranslations("quotes");
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);

  const {
    clearFilters,
    hasActiveFilters,
    listParams,
    setBookId,
    setFilter,
    setPage,
    setSearch,
    setSort,
    state,
  } = useQuotesQuery();

  const quotes = useQuotes(listParams);
  const summary = useQuotesSummary();
  const filterBook = useQuoteBook(state.bookId);

  const selectedBook = filterBook.data === undefined ? null : toQuoteBookOption(filterBook.data);
  const showSidebar = !quotes.isError;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-4 motion-safe:animate-in motion-safe:duration-500 motion-safe:fill-mode-both motion-safe:fade-in motion-safe:slide-in-from-bottom-1">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-heading text-[clamp(1.875rem,4vw,2.75rem)] leading-tight font-semibold text-ink">
              {t("title")}
            </h1>
            <TitleLeaf />
            {summary.data ? (
              <Badge variant="secondary">
                {t("countBadge", { count: summary.data.totalCount })}
              </Badge>
            ) : null}
          </div>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
            {t("subtitle")}
          </p>
        </div>
      </header>

      <ToolbarSlot
        isError={quotes.isError}
        isPending={quotes.isPending}
        toolbar={
          <QuotesToolbar
            book={selectedBook}
            filter={state.filter}
            onAddQuote={() => setAddOpen(true)}
            onBookChange={setBookId}
            onFilterChange={setFilter}
            onSearch={setSearch}
            onSortChange={setSort}
            search={state.q}
            sort={state.sort}
          />
        }
      />

      <div className="flex flex-col gap-8 xl:flex-row xl:items-start xl:gap-6">
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <QuotesContent
            hasActiveFilters={hasActiveFilters}
            isError={quotes.isError}
            isPending={quotes.isPending}
            listIdentity={quotesListIdentity(listParams)}
            onAddQuote={() => setAddOpen(true)}
            onClearFilters={clearFilters}
            onOpenBooks={() => router.push("/books")}
            onPageChange={setPage}
            onRetry={() => void quotes.refetch()}
            quotes={quotes.data}
          />
        </div>

        {showSidebar ? (
          <QuotesSidebar
            isLoading={summary.isPending}
            onAddQuote={() => setAddOpen(true)}
            onClearFilters={clearFilters}
            onShowFavorites={() => setFilter("favorites")}
            onShowRecent={() => setSort("newest")}
            onShowWithComment={() => setFilter("with_comment")}
            summary={summary.data}
          />
        ) : null}
      </div>

      <QuoteDialog mode="createWithBookPicker" onOpenChange={setAddOpen} open={addOpen} />
    </div>
  );
}

function ToolbarSlot({
  isError,
  isPending,
  toolbar,
}: {
  isError: boolean;
  isPending: boolean;
  toolbar: ReactNode;
}) {
  if (isError) return null;
  if (isPending) return <QuotesToolbarSkeleton />;
  return toolbar;
}
