"use client";

import type { QuoteView } from "@app/shared";
import type { Ref } from "react";

import { useTranslations } from "next-intl";

import type { LibraryPresence } from "@/features/books/api/use-library-presence";
import type { EmptyStateEntry } from "@/lib/empty-states";

import { EmptyState } from "@/components/empty-state";
import { InfiniteScrollFooter } from "@/components/infinite-scroll-footer";
import { RefreshingRegion } from "@/components/refreshing-region";
import { Skeleton } from "@/components/ui/skeleton";
import { infiniteScrollStateOf } from "@/hooks/use-infinite-scroll-sentinel";
import { assertNever } from "@/lib/assert-never";
import { cn } from "@/lib/utils";

import type { QuotesViewMode } from "../model/quotes-query";

import { QuoteArchiveCard } from "./quote/quote-archive-card";
import { QUOTE_CARD_SHELL } from "./quote/quote-card-shell";

const SKELETON_COUNT = 6;

type QuotesContentProps = {
  hasActiveFilters: boolean;
  hasNextPage: boolean;
  isError: boolean;
  isFetchingNextPage: boolean;
  isLoadMoreError: boolean;
  isPending: boolean;
  isRefreshing: boolean;
  libraryPresence: LibraryPresence;
  listIdentity: string;
  onAddFirstBook: () => void;
  onAddQuote: () => void;
  onClearFilters: () => void;
  onLoadMore: () => void;
  onOpenBooks: () => void;
  onRetry: () => void;
  quotes: QuoteView[];
  retryButtonRef: Ref<HTMLButtonElement>;
  view: QuotesViewMode;
};

export function QuotesContent({
  hasActiveFilters,
  hasNextPage,
  isError,
  isFetchingNextPage,
  isLoadMoreError,
  isPending,
  isRefreshing,
  libraryPresence,
  listIdentity,
  onAddFirstBook,
  onAddQuote,
  onClearFilters,
  onLoadMore,
  onOpenBooks,
  onRetry,
  quotes,
  retryButtonRef,
  view,
}: QuotesContentProps) {
  const t = useTranslations("quotes");
  const tBooks = useTranslations("books");

  const errorState: EmptyStateEntry = {
    desc: t("error.description"),
    illu: "error-generic",
    primary: { icon: "refresh", label: t("actions.retry") },
    title: t("error.load"),
  };

  if (isError) {
    return (
      <div aria-live="assertive" role="alert">
        <EmptyState onPrimary={onRetry} primaryRef={retryButtonRef} state={errorState} />
      </div>
    );
  }

  if (isPending) {
    return <QuotesSkeleton view={view} />;
  }

  if (quotes.length === 0 && !hasActiveFilters) {
    switch (libraryPresence.kind) {
      case "error":
        return (
          <div aria-live="assertive" role="alert">
            <EmptyState
              onPrimary={libraryPresence.retry}
              primaryRef={retryButtonRef}
              state={errorState}
            />
          </div>
        );
      case "pending":
        return <QuotesSkeleton view={view} />;
      case "ready": {
        if (libraryPresence.total === 0) {
          const noBooksState: EmptyStateEntry = {
            desc: t("empty.noBooks.description"),
            illu: "empty-quotes",
            primary: { icon: "plus", label: tBooks("firstBook.cta") },
            title: t("empty.noBooks.title"),
          };
          return <EmptyState onPrimary={onAddFirstBook} state={noBooksState} />;
        }
        const emptyState: EmptyStateEntry = {
          desc: t("empty.description"),
          illu: "empty-quotes",
          primary: { icon: "plus", label: t("actions.add") },
          secondary: { icon: "book", label: t("empty.secondary") },
          title: t("empty.title"),
        };
        return <EmptyState onPrimary={onAddQuote} onSecondary={onOpenBooks} state={emptyState} />;
      }
      default:
        return assertNever(libraryPresence);
    }
  }

  if (quotes.length === 0) {
    const noResultsState: EmptyStateEntry = {
      desc: t("noResults.description"),
      illu: "empty-search",
      primary: { icon: "x", label: t("noResults.clear") },
      title: t("noResults.title"),
    };
    return (
      <RefreshingRegion isRefreshing={isRefreshing}>
        <EmptyState onPrimary={onClearFilters} state={noResultsState} />
      </RefreshingRegion>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <RefreshingRegion isRefreshing={isRefreshing}>
        <ul
          className={cn("grid grid-cols-1 items-start gap-4", view === "grid" && "md:grid-cols-2")}
          key={listIdentity}
        >
          {quotes.map((quote) => (
            <li className="flex min-w-0" key={quote.id}>
              <QuoteArchiveCard quote={quote} />
            </li>
          ))}
        </ul>
      </RefreshingRegion>

      <InfiniteScrollFooter
        allShownLabel={t("allShown")}
        className="pt-2 text-center"
        errorLabel={t("loadMoreError")}
        onLoadMore={onLoadMore}
        state={infiniteScrollStateOf({
          hasNextPage,
          isFetchingNextPage,
          isFetchNextPageError: isLoadMoreError,
        })}
      />
    </div>
  );
}

function QuotesSkeleton({ view }: { view: QuotesViewMode }) {
  const t = useTranslations("quotes");

  return (
    <div
      aria-busy
      className={cn("grid grid-cols-1 items-start gap-4", view === "grid" && "md:grid-cols-2")}
      role="status"
    >
      <span className="sr-only">{t("loading")}</span>
      {Array.from({ length: SKELETON_COUNT }, (_, index) => (
        <div className={cn(QUOTE_CARD_SHELL.base, QUOTE_CARD_SHELL.fixedHeight)} key={index}>
          <div className="flex items-center gap-3">
            <Skeleton className="aspect-[3/4] w-10 shrink-0 rounded-md" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-3.5 w-2/5" />
              <Skeleton className="h-3 w-1/4" />
            </div>
          </div>
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      ))}
    </div>
  );
}
