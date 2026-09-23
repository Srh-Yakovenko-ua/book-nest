"use client";

import type { Nullable } from "@app/shared";

import { useTranslations } from "next-intl";
import { useState } from "react";

import type { EmptyStateEntry } from "@/lib/empty-states";

import { EmptyState } from "@/components/empty-state";
import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import type {
  GenresEmptyReason,
  GenresListState,
  GenresNextPageState,
} from "../model/genres-list-state";

import { assertNever } from "../model/assert-never";
import { GenreCard } from "./genre-card";

const GENRES_GRID = {
  className: "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4",
  firstCardLink: "a[href]",
  skeletonCount: 6,
  skeletonCovers: 4,
} as const;

type GenresContentProps = {
  listKey: string;
  onClearSearch: () => void;
  onLoadMore: () => void;
  onOpenLibrary: () => void;
  onResetFilters: () => void;
  onRetry: () => void;
  state: GenresListState;
};

export function GenresContent({
  listKey,
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
      return <GenresGrid listKey={listKey} onLoadMore={onLoadMore} state={state} />;
    default:
      return assertNever(state);
  }
}

function focusOnMount(element: Nullable<HTMLElement>) {
  element?.focus();
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
  listKey,
  onLoadMore,
  state,
}: {
  listKey: string;
  onLoadMore: () => void;
  state: Extract<GenresListState, { kind: "ready" }>;
}) {
  const [firstNewGenreIndex, setFirstNewGenreIndex] = useState<Nullable<number>>(null);
  const [trackedListKey, setTrackedListKey] = useState(listKey);

  if (trackedListKey !== listKey) {
    setTrackedListKey(listKey);
    setFirstNewGenreIndex(null);
  }

  if (firstNewGenreIndex !== null && state.nextPage === "error") {
    setFirstNewGenreIndex(null);
  }

  function loadMore() {
    setFirstNewGenreIndex(state.genres.length);
    onLoadMore();
  }

  function focusFirstNewGenre(item: Nullable<HTMLLIElement>) {
    if (item === null) return;
    item.querySelector<HTMLElement>(GENRES_GRID.firstCardLink)?.focus();
    setFirstNewGenreIndex(null);
  }

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
        {state.genres.map((genre, index) => (
          <li
            className="flex min-w-0 flex-col"
            key={genre.key}
            ref={index === firstNewGenreIndex ? focusFirstNewGenre : undefined}
          >
            <GenreCard genre={genre} />
          </li>
        ))}
      </ul>

      <GenresLoadMore onLoadMore={loadMore} state={state.nextPage} />
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

function GenresLoadMore({
  onLoadMore,
  state,
}: {
  onLoadMore: () => void;
  state: GenresNextPageState;
}) {
  const t = useTranslations("genres.list");

  switch (state) {
    case "error":
      return (
        <div
          className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-4 text-center"
          role="alert"
        >
          <p className="text-sm text-muted-foreground">{t("loadMoreError")}</p>
          <Button onClick={onLoadMore} ref={focusOnMount} size="sm" variant="secondary">
            <UiIcon name="refresh" size={14} />
            {t("retry")}
          </Button>
        </div>
      );
    case "idle":
    case "loading":
      return (
        <div className="flex justify-center">
          <Button
            disabled={state === "loading"}
            loading={state === "loading"}
            onClick={onLoadMore}
            variant="secondary"
          >
            {t("loadMore")}
          </Button>
        </div>
      );
    case "none":
      return null;
    default:
      return assertNever(state);
  }
}
