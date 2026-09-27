"use client";

import type { LibraryPublisherListItem, Nullable } from "@app/shared";

import { useTranslations } from "next-intl";
import { type RefObject, useEffect, useRef } from "react";

import type { InfiniteScrollState } from "@/hooks/use-infinite-scroll-sentinel";

import { EmptyState } from "@/components/empty-state";
import { InfiniteScrollFooter } from "@/components/infinite-scroll-footer";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import type { PublishersArchiveState } from "../model/publisher-archive-state";
import type { PublishersViewMode } from "../model/publisher-query";

import { PublisherCard } from "./publisher-card";
import { PublisherRow } from "./publisher-row";

const SKELETON_COUNT = 6;

const GRID_COLUMNS = {
  withoutSidebar: "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3",
  withSidebar: "grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3",
} as const;

export type PublishersLoadMore = {
  hasNextPage: boolean;
  isError: boolean;
  isFetching: boolean;
  onLoadMore: () => void;
};

type PublishersContentProps = {
  hasSidebar: boolean;
  loadMore: PublishersLoadMore;
  onAddBook: () => void;
  onClearAll: () => void;
  onClearSearch: () => void;
  onResetFilters: () => void;
  onRetry: () => void;
  state: PublishersArchiveState;
  view: PublishersViewMode;
};

export function PublishersContent({
  hasSidebar,
  loadMore,
  onAddBook,
  onClearAll,
  onClearSearch,
  onResetFilters,
  onRetry,
  state,
  view,
}: PublishersContentProps) {
  const t = useTranslations("publishers.states");
  const gridColumns = hasSidebar ? GRID_COLUMNS.withSidebar : GRID_COLUMNS.withoutSidebar;

  switch (state.kind) {
    case "empty":
      return (
        <EmptyState
          onPrimary={onAddBook}
          state={{
            desc: t("empty.description"),
            illu: "empty-publishers",
            primary: { icon: "plus", label: t("empty.addBook") },
            title: t("empty.title"),
          }}
        />
      );
    case "error":
      return (
        <div aria-live="assertive" role="alert">
          <EmptyState
            onPrimary={onRetry}
            state={{
              desc: t("error.description"),
              illu: "error-generic",
              primary: { icon: "refresh", label: t("error.retry") },
              title: t("error.title"),
            }}
          />
        </div>
      );
    case "loading":
      return <PublishersSkeleton gridColumns={gridColumns} view={view} />;
    case "noFilteredResults":
      return (
        <EmptyState
          onPrimary={onResetFilters}
          onSecondary={onClearAll}
          state={{
            desc: t("noFilteredResults.description"),
            illu: "empty-search",
            primary: { icon: "x", label: t("noFilteredResults.reset") },
            secondary: { icon: "x", label: t("noFilteredResults.clearAll") },
            title: t("noFilteredResults.title"),
          }}
        />
      );
    case "noSearchResults":
      return (
        <EmptyState
          onPrimary={onClearSearch}
          state={{
            desc: t("noSearchResults.description"),
            illu: "empty-search",
            primary: { icon: "x", label: t("noSearchResults.clear") },
            title: t("noSearchResults.title"),
          }}
        />
      );
    case "results":
      return (
        <PublishersResultsSection
          gridColumns={gridColumns}
          loadMore={loadMore}
          publishers={state.items}
          view={view}
        />
      );
  }
}

function focusWasLost(): boolean {
  return document.activeElement === null || document.activeElement === document.body;
}

function nextPageState({
  hasNextPage,
  isError,
  isFetching,
}: PublishersLoadMore): InfiniteScrollState {
  if (isFetching) return "loading";
  if (isError) return "error";
  if (hasNextPage) return "idle";
  return "none";
}

function PublishersResults({
  gridColumns,
  listRef,
  publishers,
  view,
}: {
  gridColumns: string;
  listRef: RefObject<Nullable<HTMLUListElement>>;
  publishers: LibraryPublisherListItem[];
  view: PublishersViewMode;
}) {
  const tPage = useTranslations("publishers.page");

  if (view === "list") {
    return (
      <ul aria-label={tPage("resultsTitle")} className="flex flex-col gap-3" ref={listRef}>
        {publishers.map((publisher) => (
          <li className="flex" key={publisher.id}>
            <PublisherRow publisher={publisher} />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul aria-label={tPage("resultsTitle")} className={cn("grid gap-5", gridColumns)} ref={listRef}>
      {publishers.map((publisher) => (
        <li className="flex" key={publisher.id}>
          <PublisherCard publisher={publisher} />
        </li>
      ))}
    </ul>
  );
}

function PublishersResultsSection({
  gridColumns,
  loadMore,
  publishers,
  view,
}: {
  gridColumns: string;
  loadMore: PublishersLoadMore;
  publishers: LibraryPublisherListItem[];
  view: PublishersViewMode;
}) {
  const t = useTranslations("publishers.results");
  const listRef = useRef<HTMLUListElement>(null);
  const firstAppendedIndexRef = useRef<Nullable<number>>(null);

  useEffect(() => {
    const firstAppendedIndex = firstAppendedIndexRef.current;
    if (firstAppendedIndex === null || loadMore.isFetching) return;
    if (!focusWasLost()) {
      firstAppendedIndexRef.current = null;
      return;
    }
    const target = listRef.current?.children.item(firstAppendedIndex)?.querySelector("a");
    if (target === null || target === undefined) return;
    firstAppendedIndexRef.current = null;
    target.focus();
  }, [loadMore.isError, loadMore.isFetching, publishers.length]);

  const requestNextPage = () => {
    if (loadMore.isFetching) return;
    firstAppendedIndexRef.current = publishers.length;
    loadMore.onLoadMore();
  };

  return (
    <div className="flex flex-col gap-6">
      <PublishersResults
        gridColumns={gridColumns}
        listRef={listRef}
        publishers={publishers}
        view={view}
      />
      <InfiniteScrollFooter
        errorLabel={t("loadMoreError")}
        onLoadMore={requestNextPage}
        retryLabel={t("loadMoreRetry")}
        state={nextPageState(loadMore)}
      />
    </div>
  );
}

function PublishersSkeleton({
  gridColumns,
  view,
}: {
  gridColumns: string;
  view: PublishersViewMode;
}) {
  const t = useTranslations("publishers.results");

  if (view === "list") {
    return (
      <div aria-busy aria-label={t("loading")} className="flex flex-col gap-3" role="status">
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
            <Skeleton className="hidden h-8 w-64 lg:block" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      aria-busy
      aria-label={t("loading")}
      className={cn("grid gap-5", gridColumns)}
      role="status"
    >
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
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-3.5 w-1/2" />
          <Skeleton className="h-3.5 w-2/3" />
        </div>
      ))}
    </div>
  );
}
