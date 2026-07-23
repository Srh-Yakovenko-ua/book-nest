"use client";

import type { LibraryPublisherListItem } from "@app/shared";

import { useTranslations } from "next-intl";

import type { EmptyStateEntry } from "@/lib/empty-states";

import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import type { PublishersViewMode } from "../model/publisher-query";

import { PublisherCard } from "./publisher-card";
import { PublisherRow } from "./publisher-row";

const SKELETON_COUNT = 6;

type PublishersContentProps = {
  hasActiveQuery: boolean;
  isError: boolean;
  isPending: boolean;
  isPlaceholderData: boolean;
  onAddBook: () => void;
  onClearAll: () => void;
  onRetry: () => void;
  publishers: LibraryPublisherListItem[];
  view: PublishersViewMode;
};

export function PublishersContent({
  hasActiveQuery,
  isError,
  isPending,
  isPlaceholderData,
  onAddBook,
  onClearAll,
  onRetry,
  publishers,
  view,
}: PublishersContentProps) {
  const t = useTranslations("publishers.states");

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
    return <PublishersSkeleton view={view} />;
  }

  if (publishers.length === 0) {
    if (hasActiveQuery) {
      const noResultsState: EmptyStateEntry = {
        desc: t("noResults.description"),
        illu: "empty-search",
        primary: { icon: "x", label: t("noResults.clear") },
        title: t("noResults.title"),
      };
      return <EmptyState onPrimary={onClearAll} state={noResultsState} />;
    }

    const emptyState: EmptyStateEntry = {
      desc: t("empty.description"),
      illu: "empty-publishers",
      primary: { icon: "plus", label: t("empty.addBook") },
      title: t("empty.title"),
    };
    return <EmptyState onPrimary={onAddBook} state={emptyState} />;
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
        {publishers.map((publisher) => (
          <li className="flex" key={publisher.id}>
            <PublisherRow publisher={publisher} />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul
      aria-busy={isPlaceholderData}
      className={cn(
        "grid grid-cols-1 gap-5 transition-opacity duration-200 motion-reduce:transition-none sm:grid-cols-2 xl:grid-cols-3",
        isPlaceholderData && "opacity-60",
      )}
    >
      {publishers.map((publisher) => (
        <li className="flex" key={publisher.id}>
          <PublisherCard publisher={publisher} />
        </li>
      ))}
    </ul>
  );
}

function PublishersSkeleton({ view }: { view: PublishersViewMode }) {
  if (view === "list") {
    return (
      <div aria-busy className="flex flex-col gap-3">
        {Array.from({ length: SKELETON_COUNT }, (_, index) => (
          <div
            className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-card"
            key={index}
          >
            <Skeleton className="size-10 shrink-0 rounded-lg" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-2/5" />
              <Skeleton className="h-3 w-1/4" />
            </div>
            <Skeleton className="hidden h-8 w-40 md:block" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div aria-busy className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: SKELETON_COUNT }, (_, index) => (
        <div
          className="flex flex-col gap-3.5 rounded-xl border border-border bg-card p-4 shadow-card"
          key={index}
        >
          <div className="flex items-start gap-3.5">
            <Skeleton className="size-12 shrink-0 rounded-xl" />
            <div className="flex flex-1 flex-col gap-2 pt-1">
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-3 w-2/5" />
            </div>
          </div>
          <Skeleton className="h-3.5 w-3/4" />
          <Skeleton className="h-3.5 w-1/2" />
          <Skeleton className="h-3.5 w-1/3" />
        </div>
      ))}
    </div>
  );
}
