"use client";

import type { BookView } from "@app/shared";

import { DEDICATIONS_PAGE_SIZE_DEFAULT } from "@app/shared";
import { useTranslations } from "next-intl";

import type { EmptyStateEntry } from "@/lib/empty-states";

import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import type { DedicationView } from "../model/dedications-query";

import { DedicationCard } from "./dedication-card";
import { DedicationRow } from "./dedication-row";

const SKELETON_COUNT = DEDICATIONS_PAGE_SIZE_DEFAULT;

type DedicationsContentProps = {
  books: BookView[];
  hasActiveFilters: boolean;
  isError: boolean;
  isPending: boolean;
  isPlaceholderData: boolean;
  onChooseBook: () => void;
  onClearFilters: () => void;
  onOpenDedication: (book: BookView) => void;
  onRetry: () => void;
  view: DedicationView;
};

export function DedicationsContent({
  books,
  hasActiveFilters,
  isError,
  isPending,
  isPlaceholderData,
  onChooseBook,
  onClearFilters,
  onOpenDedication,
  onRetry,
  view,
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
    return <DedicationsSkeleton view={view} />;
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
      primary: { icon: "book", label: t("empty.cta") },
      title: t("empty.title"),
    };
    return <EmptyState onPrimary={onChooseBook} state={emptyState} />;
  }

  if (view === "list") {
    return (
      <ul
        aria-busy={isPlaceholderData}
        className={cn(
          "flex flex-col gap-3 transition-opacity duration-200 motion-reduce:transition-none",
          isPlaceholderData && "opacity-60",
        )}
      >
        {books.map((book) => (
          <li key={book.id}>
            <DedicationRow book={book} onOpen={() => onOpenDedication(book)} />
          </li>
        ))}
      </ul>
    );
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

function DedicationsSkeleton({ view }: { view: DedicationView }) {
  if (view === "list") {
    return (
      <div aria-busy className="flex flex-col gap-3">
        {Array.from({ length: SKELETON_COUNT }, (_, index) => (
          <Skeleton className="h-28 w-full rounded-[18px]" key={index} />
        ))}
      </div>
    );
  }

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
          <Skeleton className="h-24 w-full rounded-md" />
          <Skeleton className="h-7 w-24 rounded-md" />
        </div>
      ))}
    </div>
  );
}
