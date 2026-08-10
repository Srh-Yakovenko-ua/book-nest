"use client";

import type { WishlistBookView } from "@app/shared";

import { useTranslations } from "next-intl";

import type { LibraryBookLabels } from "@/features/books";
import type { EmptyStateEntry } from "@/lib/empty-states";

import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { toLibraryBook } from "@/features/books";

import type { WishlistViewMode } from "../model/books-to-buy-derive";

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
  view?: WishlistViewMode;
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
  view = "grid",
}: BooksToBuyContentProps) {
  const t = useTranslations("booksToBuy");
  const tAgeCategory = useTranslations("books.classification.ageCategoryLabels");
  const tFormat = useTranslations("books.format.options");
  const tLibrary = useTranslations("books.library");
  const tOwnership = useTranslations("books.ownershipStatus.options");
  const tStatus = useTranslations("books.readingStatus.options");
  const labels: LibraryBookLabels = {
    ageBadge18Plus: tAgeCategory("18_plus"),
    borrowedFrom: (name: string) => tLibrary("card.borrowedFrom", { name }),
    formatLabel: (value) => tFormat(value),
    genreName: (key: string) => key,
    lentTo: (name: string) => tLibrary("card.lentTo", { name }),
    ownershipLabel: (value) => tOwnership(value),
    pagesText: (value: number) => tLibrary("meta.pages", { value }),
    progressAriaLabel: (current: number, total: number) =>
      tLibrary("progress.ariaLabel", { current, total }),
    progressUnit: tLibrary("progress.unit"),
    ratingLabel: (value: number) => tLibrary("rating.ariaLabel", { value }),
    seriesPosition: (position: number, total: number) =>
      tLibrary("card.seriesPosition", { position, total }),
    statusLabel: (value) => tStatus(value),
  };

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
    return <BooksToBuySkeleton view={view} />;
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
    <ul
      className={
        view === "grid"
          ? "grid grid-cols-2 gap-5 max-sm:gap-3 xl:grid-cols-3"
          : "flex flex-col gap-2.5"
      }
    >
      {books.map((book) => (
        <li key={book.id}>
          <BooksToBuyRow book={book} libraryBook={toLibraryBook(book, labels)} view={view} />
        </li>
      ))}
    </ul>
  );
}

function BooksToBuySkeleton({ view }: { view: WishlistViewMode }) {
  if (view === "list") {
    return (
      <div aria-busy className="flex flex-col gap-2.5">
        {Array.from({ length: SKELETON_COUNT }, (_, index) => (
          <div
            className="flex min-h-[9.5rem] items-stretch gap-3.5 rounded-xl border border-border bg-card p-3 shadow-card"
            key={index}
          >
            <Skeleton className="w-24 shrink-0 rounded-lg" />
            <div className="flex flex-1 flex-col gap-2 py-1">
              <Skeleton className="h-4 w-2/5" />
              <Skeleton className="h-3 w-1/4" />
              <Skeleton className="mt-auto h-9 w-full max-w-sm" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div aria-busy className="grid grid-cols-2 gap-5 max-sm:gap-3 xl:grid-cols-3">
      {Array.from({ length: SKELETON_COUNT }, (_, index) => (
        <div
          className="flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-card"
          key={index}
        >
          <Skeleton className="aspect-[3/4] w-full rounded-none" />
          <div className="flex flex-col gap-2 p-4 max-sm:px-2">
            <Skeleton className="h-5 w-4/5" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="mt-2 h-8 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
