"use client";

import type { WishlistBookView } from "@app/shared";

import { useTranslations } from "next-intl";

import type { EmptyStateEntry } from "@/lib/empty-states";

import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

import { BooksToBuyRow } from "./books-to-buy-row";

const SKELETON_COUNT = 6;

type BooksToBuyContentProps = {
  books: WishlistBookView[];
  hasAnyBooks: boolean;
  isError: boolean;
  isPending: boolean;
  onAddBook: () => void;
  onClearFilters: () => void;
  onOpenLibrary: () => void;
  onRetry: () => void;
};

export function BooksToBuyContent({
  books,
  hasAnyBooks,
  isError,
  isPending,
  onAddBook,
  onClearFilters,
  onOpenLibrary,
  onRetry,
}: BooksToBuyContentProps) {
  const t = useTranslations("booksToBuy");

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
    return <BooksToBuySkeleton />;
  }

  if (!hasAnyBooks) {
    const emptyState: EmptyStateEntry = {
      desc: t("empty.description"),
      illu: "empty-purchases",
      primary: { icon: "plus", label: t("empty.cta") },
      secondary: { icon: "book", label: t("empty.secondary") },
      title: t("empty.title"),
    };
    return <EmptyState onPrimary={onAddBook} onSecondary={onOpenLibrary} state={emptyState} />;
  }

  if (books.length === 0) {
    const noResultsState: EmptyStateEntry = {
      desc: t("noResults.description"),
      illu: "empty-search",
      primary: { icon: "x", label: t("noResults.clear") },
      title: t("noResults.title"),
    };
    return <EmptyState onPrimary={onClearFilters} state={noResultsState} />;
  }

  return (
    <ul className="flex flex-col gap-2.5">
      {books.map((book) => (
        <li key={book.id}>
          <BooksToBuyRow book={book} />
        </li>
      ))}
    </ul>
  );
}

function BooksToBuySkeleton() {
  return (
    <div aria-busy className="flex flex-col gap-2.5">
      {Array.from({ length: SKELETON_COUNT }, (_, index) => (
        <div
          className="flex items-center gap-3.5 rounded-xl border border-border bg-card p-3 shadow-card"
          key={index}
        >
          <Skeleton className="aspect-[3/4] w-11 shrink-0 rounded-md" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-3 w-1/4" />
          </div>
        </div>
      ))}
    </div>
  );
}
