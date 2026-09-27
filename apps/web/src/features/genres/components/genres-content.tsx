"use client";

import { useTranslations } from "next-intl";

import type { EmptyStateEntry } from "@/lib/empty-states";

import { EmptyState } from "@/components/empty-state";
import { InfiniteScrollFooter } from "@/components/infinite-scroll-footer";
import { Skeleton } from "@/components/ui/skeleton";
import { assertNever } from "@/lib/assert-never";
import { cn } from "@/lib/utils";

import type { GenresEmptyReason, GenresListState } from "../model/genres-list-state";

import { GenreCard } from "./genre-card";

const GENRES_GRID = {
  className: "grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3",
  skeletonCount: 6,
  skeletonCovers: 4,
} as const;

type GenresContentProps = {
  onClearSearch: () => void;
  onLoadMore: () => void;
  onOpenLibrary: () => void;
  onResetFilters: () => void;
  onRetry: () => void;
  state: GenresListState;
};

export function GenresContent({
  onClearSearch,
  onLoadMore,
  onOpenLibrary,
  onResetFilters,
  onRetry,
  state,
}: GenresContentProps) {
  switch (state.kind) {
    case "empty":
      return (
        <GenresEmpty
          onClearSearch={onClearSearch}
          onOpenLibrary={onOpenLibrary}
          onResetFilters={onResetFilters}
          reason={state.reason}
        />
      );
    case "error":
      return <GenresError onRetry={onRetry} />;
    case "loading":
      return <GenresGridSkeleton />;
    case "ready":
      return <GenresGrid onLoadMore={onLoadMore} state={state} />;
    default:
      return assertNever(state);
  }
}

function GenresEmpty({
  onClearSearch,
  onOpenLibrary,
  onResetFilters,
  reason,
}: {
  onClearSearch: () => void;
  onOpenLibrary: () => void;
  onResetFilters: () => void;
  reason: GenresEmptyReason;
}) {
  const t = useTranslations("genres.states");

  switch (reason) {
    case "filters": {
      const entry: EmptyStateEntry = {
        desc: t("emptyFilters.description"),
        illu: "empty-search",
        primary: { icon: "x", label: t("emptyFilters.action") },
        title: t("emptyFilters.title"),
      };
      return <EmptyState onPrimary={onResetFilters} state={entry} />;
    }
    case "library": {
      const entry: EmptyStateEntry = {
        desc: t("empty.description"),
        illu: "empty-library",
        primary: { icon: "library", label: t("empty.action") },
        title: t("empty.title"),
      };
      return <EmptyState onPrimary={onOpenLibrary} state={entry} />;
    }
    case "search": {
      const entry: EmptyStateEntry = {
        desc: t("emptySearch.description"),
        illu: "empty-search",
        primary: { icon: "x", label: t("emptySearch.action") },
        title: t("emptySearch.title"),
      };
      return <EmptyState onPrimary={onClearSearch} state={entry} />;
    }
    default:
      return assertNever(reason);
  }
}

function GenresError({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations("genres.states.error");
  const entry: EmptyStateEntry = {
    desc: t("description"),
    illu: "error-generic",
    primary: { icon: "refresh", label: t("retry") },
    title: t("title"),
  };

  return (
    <div aria-live="assertive" role="alert">
      <EmptyState onPrimary={onRetry} state={entry} />
    </div>
  );
}

function GenresGrid({
  onLoadMore,
  state,
}: {
  onLoadMore: () => void;
  state: Extract<GenresListState, { kind: "ready" }>;
}) {
  const t = useTranslations("genres.list");

  return (
    <div className="flex flex-col gap-6">
      <ul
        aria-busy={state.isRefreshing}
        className={cn(
          GENRES_GRID.className,
          "transition-opacity duration-200 motion-reduce:transition-none",
          state.isRefreshing && "opacity-60",
        )}
      >
        {state.genres.map((genre) => (
          <li className="flex min-w-0 flex-col" key={genre.key}>
            <GenreCard genre={genre} />
          </li>
        ))}
      </ul>

      <InfiniteScrollFooter
        errorLabel={t("loadMoreError")}
        onLoadMore={onLoadMore}
        retryLabel={t("retry")}
        state={state.nextPage}
      />
    </div>
  );
}

function GenresGridSkeleton() {
  const t = useTranslations("genres.list");

  return (
    <div aria-busy aria-label={t("loading")} className={GENRES_GRID.className} role="status">
      {Array.from({ length: GENRES_GRID.skeletonCount }, (_, index) => (
        <div
          className="flex flex-col gap-3.5 rounded-xl border border-border bg-card p-4 shadow-card"
          data-slot="genre-card-skeleton"
          key={index}
        >
          <div className="flex items-start gap-3">
            <Skeleton className="size-10 shrink-0 rounded-full" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-3/5" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-3 w-2/5" />
            <Skeleton className="h-1.5 w-full rounded-full" />
          </div>
          <div className="flex gap-1.5">
            {Array.from({ length: GENRES_GRID.skeletonCovers }, (_, cover) => (
              <Skeleton className="aspect-[3/4] w-9 rounded-sm" key={cover} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
