"use client";

import { useTranslations } from "next-intl";

import type { EmptyStateEntry } from "@/lib/empty-states";

import { EmptyState } from "@/components/empty-state";
import { InfiniteScrollFooter } from "@/components/infinite-scroll-footer";
import { Skeleton } from "@/components/ui/skeleton";
import { assertNever } from "@/lib/assert-never";

import type { BookQuotesEmptyReason, BookQuotesListState } from "../model/book-quotes-list-state";

import { useBookQuotesEmptyCopy } from "../model/use-book-quotes-empty-copy";
import { QuoteArchiveCard } from "./quote/quote-archive-card";
import { QUOTE_CARD_SHELL } from "./quote/quote-card-shell";

const BOOK_QUOTES_LIST = {
  column: "flex flex-col gap-4",
  skeletonCount: 4,
} as const;

type BookQuotesListProps = {
  onAddQuote: () => void;
  onClearFilters: () => void;
  onClearSearch: () => void;
  onLoadMore: () => void;
  onRetry: () => void;
  state: BookQuotesListState;
};

export function BookQuotesList({
  onAddQuote,
  onClearFilters,
  onClearSearch,
  onLoadMore,
  onRetry,
  state,
}: BookQuotesListProps) {
  const emptyCopy = useBookQuotesEmptyCopy();
  const emptyActions = {
    book: onAddQuote,
    filters: onClearFilters,
    search: onClearSearch,
  } satisfies Record<BookQuotesEmptyReason, () => void>;

  switch (state.kind) {
    case "empty":
      return <EmptyState onPrimary={emptyActions[state.reason]} state={emptyCopy[state.reason]} />;
    case "error":
      return <BookQuotesError onRetry={onRetry} />;
    case "loading":
      return <BookQuotesSkeleton />;
    case "ready":
      return <BookQuotesReady onLoadMore={onLoadMore} state={state} />;
    default:
      return assertNever(state);
  }
}

function BookQuotesError({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations("quotes");

  const errorState: EmptyStateEntry = {
    desc: t("error.description"),
    illu: "error-generic",
    primary: { icon: "refresh", label: t("actions.retry") },
    title: t("error.load"),
  };

  return (
    <div aria-live="assertive" role="alert">
      <EmptyState onPrimary={onRetry} state={errorState} />
    </div>
  );
}

function BookQuotesReady({
  onLoadMore,
  state,
}: {
  onLoadMore: () => void;
  state: Extract<BookQuotesListState, { kind: "ready" }>;
}) {
  const t = useTranslations("quotes");

  return (
    <div className="flex flex-col gap-6">
      <ul className={BOOK_QUOTES_LIST.column}>
        {state.quotes.map((quote) => (
          <li className="flex min-w-0" data-quote-id={quote.id} key={quote.id}>
            <QuoteArchiveCard layout="embedded" quote={quote} />
          </li>
        ))}
      </ul>

      <InfiniteScrollFooter
        allShownLabel={t("allShown")}
        className="pt-2 text-center"
        errorFocus="none"
        errorLabel={t("loadMoreError")}
        onLoadMore={onLoadMore}
        state={state.nextPage}
      />
    </div>
  );
}

function BookQuotesSkeleton() {
  const t = useTranslations("quotes");

  return (
    <div aria-busy aria-label={t("loading")} className={BOOK_QUOTES_LIST.column} role="group">
      {Array.from({ length: BOOK_QUOTES_LIST.skeletonCount }, (_, index) => (
        <div className={QUOTE_CARD_SHELL.base} key={index}>
          <Skeleton className="ml-auto h-8 w-16 rounded-md" />
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      ))}
    </div>
  );
}
