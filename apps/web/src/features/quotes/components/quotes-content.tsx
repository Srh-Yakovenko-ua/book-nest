"use client";

import { useTranslations } from "next-intl";

import type { EmptyStateEntry } from "@/lib/empty-states";

import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

import type { QuotesPage } from "../api/use-quotes";

import { QuoteCard } from "./quote-card";
import { QuotesPagination } from "./quotes-pagination";

const SKELETON_COUNT = 6;

type QuotesContentProps = {
  hasActiveFilters: boolean;
  isError: boolean;
  isPending: boolean;
  listIdentity: string;
  onAddQuote: () => void;
  onClearFilters: () => void;
  onOpenBooks: () => void;
  onPageChange: (page: number) => void;
  onRetry: () => void;
  quotes: QuotesPage | undefined;
};

export function QuotesContent({
  hasActiveFilters,
  isError,
  isPending,
  listIdentity,
  onAddQuote,
  onClearFilters,
  onOpenBooks,
  onPageChange,
  onRetry,
  quotes,
}: QuotesContentProps) {
  const t = useTranslations("quotes");

  if (isError) {
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

  if (isPending || quotes === undefined) {
    return <QuotesSkeleton />;
  }

  if (quotes.items.length === 0 && !hasActiveFilters) {
    const emptyState: EmptyStateEntry = {
      desc: t("empty.description"),
      illu: "empty-quotes",
      primary: { icon: "plus", label: t("actions.add") },
      secondary: { icon: "book", label: t("empty.secondary") },
      title: t("empty.title"),
    };
    return <EmptyState onPrimary={onAddQuote} onSecondary={onOpenBooks} state={emptyState} />;
  }

  if (quotes.items.length === 0) {
    const noResultsState: EmptyStateEntry = {
      desc: t("noResults.description"),
      illu: "empty-search",
      primary: { icon: "x", label: t("noResults.clear") },
      title: t("noResults.title"),
    };
    return <EmptyState onPrimary={onClearFilters} state={noResultsState} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <ul className="grid gap-4 md:grid-cols-2" key={listIdentity}>
        {quotes.items.map((quote) => (
          <li className="flex" key={quote.id}>
            <QuoteCard quote={quote} variant="archive" />
          </li>
        ))}
      </ul>

      <QuotesPagination
        onPageChange={onPageChange}
        page={quotes.page}
        pagesCount={quotes.pagesCount}
      />
    </div>
  );
}

export function QuotesSkeleton() {
  const t = useTranslations("quotes");

  return (
    <div aria-busy className="grid gap-4 md:grid-cols-2" role="status">
      <span className="sr-only">{t("loading")}</span>
      {Array.from({ length: SKELETON_COUNT }, (_, index) => (
        <div
          className="flex flex-col gap-3 rounded-xl border border-accent-border bg-accent/25 p-4"
          key={index}
        >
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
