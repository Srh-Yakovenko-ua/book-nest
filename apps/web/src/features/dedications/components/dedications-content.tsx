"use client";

import type { BookView } from "@app/shared";

import { DEDICATIONS_PAGE_SIZE_DEFAULT } from "@app/shared";
import { useTranslations } from "next-intl";

import type { EmptyStateEntry } from "@/lib/empty-states";

import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { DedicationCard } from "./dedication-card";

const SKELETON_COUNT = DEDICATIONS_PAGE_SIZE_DEFAULT;

type DedicationsContentProps = {
  books: BookView[];
  hasActiveFilters: boolean;
  isError: boolean;
  isPending: boolean;
  isPlaceholderData: boolean;
  onAddBook: () => void;
  onClearFilters: () => void;
  onOpenDedication: (book: BookView) => void;
  onOpenLibrary: () => void;
  onRetry: () => void;
};

export function DedicationsContent({
  books,
  hasActiveFilters,
  isError,
  isPending,
  isPlaceholderData,
  onAddBook,
  onClearFilters,
  onOpenDedication,
  onOpenLibrary,
  onRetry,
}: DedicationsContentProps) {
  const t = useTranslations("dedications");

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
    return <DedicationsSkeleton />;
  }

  if (books.length === 0) {
    if (hasActiveFilters) {
      const noResultsState: EmptyStateEntry = {
        desc: t("noResults.description"),
        illu: "empty-search",
        primary: { icon: "x", label: t("noResults.clear") },
        title: t("noResults.title"),
      };
      return <EmptyState onPrimary={onClearFilters} state={noResultsState} />;
    }

    const emptyState: EmptyStateEntry = {
      desc: t("empty.description"),
      illu: "empty-quotes",
      primary: { icon: "plus", label: t("empty.cta") },
      secondary: { icon: "book", label: t("empty.secondary") },
      title: t("empty.title"),
    };
    return <EmptyState onPrimary={onAddBook} onSecondary={onOpenLibrary} state={emptyState} />;
  }

  return (
    <ul
      aria-busy={isPlaceholderData}
      className={cn(
        "grid grid-cols-1 gap-4 transition-opacity duration-200 motion-reduce:transition-none sm:grid-cols-2 xl:grid-cols-3",
        isPlaceholderData && "opacity-60",
      )}
    >
      {books.map((book) => (
        <li className="flex" key={book.id}>
          <DedicationCard book={book} onOpen={() => onOpenDedication(book)} />
        </li>
      ))}
    </ul>
  );
}

function DedicationsSkeleton() {
  return (
    <div aria-busy className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: SKELETON_COUNT }, (_, index) => (
        <div
          className="flex flex-col gap-3 rounded-[18px] border border-border bg-card p-4 shadow-card"
          key={index}
        >
          <div className="flex items-start gap-3">
            <Skeleton className="aspect-[3/4] w-12 shrink-0 rounded-md" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-3/5" />
              <Skeleton className="h-3 w-2/5" />
            </div>
          </div>
          <Skeleton className="h-16 w-full rounded-md" />
          <Skeleton className="h-7 w-24 rounded-md" />
        </div>
      ))}
    </div>
  );
}
