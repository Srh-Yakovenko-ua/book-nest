"use client";

import type { ReactNode } from "react";

import { useTranslations } from "next-intl";
import { useRef } from "react";

import { TitleLeaf } from "@/components/title-leaf";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "@/i18n/navigation";
import { assertNever } from "@/lib/assert-never";

import type { GenresEmptyReason, GenresListState } from "../model/genres-list-state";

import { useGenreFacets } from "../api/use-genre-facets";
import { useGenreSummary } from "../api/use-genre-summary";
import { useGenresList } from "../api/use-genres-list";
import { useGenresOverview } from "../api/use-genres-overview";
import { hasGenreInsights } from "../model/genre-insights";
import { genresListState } from "../model/genres-list-state";
import { useGenreSummaryCards } from "../model/use-genre-summary-cards";
import { useGenresQuery } from "../model/use-genres-query";
import { GenresContent } from "./genres-content";
import {
  GenresInsightsPanel,
  GenresInsightsSidebar,
  GenresInsightsSidebarSkeleton,
} from "./genres-insights";
import { GenresSummaryCards, GenresSummaryPanel } from "./genres-summary";
import { GenresToolbar, GenresToolbarSkeleton } from "./genres-toolbar";

const EMPTY_TITLE_KEYS = {
  filters: "emptyFilters",
  library: "empty",
  search: "emptySearch",
} as const satisfies Record<GenresEmptyReason, string>;

const GENRES_PAGE = {
  libraryPath: "/books",
  searchInput: "input",
} as const;

export function Genres() {
  const t = useTranslations("genres.page");
  const tGenres = useTranslations("genres");
  const toolbarRef = useRef<HTMLDivElement>(null);
  const resultsHeadingRef = useRef<HTMLHeadingElement>(null);
  const router = useRouter();
  const query = useGenresQuery();
  const list = useGenresList(query.listParams);
  const facets = useGenreFacets(query.datasetParams);
  const summary = useGenreSummary();
  const overview = useGenresOverview();
  const summaryCards = useGenreSummaryCards(summary.data);

  const listState = genresListState({
    hasActiveFilters: query.hasActiveFilters,
    hasActiveSearch: query.hasActiveSearch,
    list,
  });
  const insights =
    overview.data !== undefined && hasGenreInsights(overview.data) ? overview.data : null;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2 motion-safe:animate-in motion-safe:duration-500 motion-safe:fill-mode-both motion-safe:fade-in motion-safe:slide-in-from-bottom-1">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-[clamp(1.875rem,4vw,2.75rem)] leading-tight font-semibold text-ink">
            {t("title")}
          </h1>
          <TitleLeaf />
        </div>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
          {t("subtitle")}
        </p>
      </header>

      {summary.isError ? null : (
        <GenresSummaryCards cards={summaryCards} isLoading={summary.isPending} />
      )}

      <div className="flex flex-col gap-2.5 empty:hidden sm:hidden">
        {summary.isError ? null : (
          <GenresSummaryPanel cards={summaryCards} isLoading={summary.isPending} />
        )}
        {overview.isPending ? <Skeleton className="h-11 w-full rounded-xl" /> : null}
        {insights === null ? null : <GenresInsightsPanel overview={insights} />}
      </div>

      <div className="empty:hidden" ref={toolbarRef}>
        {toolbarSlot(listState)}
      </div>

      <p aria-atomic className="sr-only" role="status">
        {listAnnouncement(listState)}
      </p>

      <div className="flex flex-col gap-8 xl:flex-row xl:items-start xl:gap-6">
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <h2 className="sr-only" ref={resultsHeadingRef} tabIndex={-1}>
            {t("resultsTitle")}
          </h2>
          <GenresContent
            onClearSearch={() => {
              query.clearSearch();
              toolbarRef.current?.querySelector<HTMLInputElement>(GENRES_PAGE.searchInput)?.focus();
            }}
            onLoadMore={() => void list.fetchNextPage()}
            onOpenLibrary={() => router.push(GENRES_PAGE.libraryPath)}
            onResetFilters={() => {
              query.resetFilters();
              resultsHeadingRef.current?.focus();
            }}
            onRetry={() => void list.refetch()}
            state={listState}
          />
        </div>
        {sidebarSlot()}
      </div>
    </div>
  );

  function listAnnouncement(state: GenresListState): string {
    switch (state.kind) {
      case "empty":
        return tGenres(`states.${EMPTY_TITLE_KEYS[state.reason]}.title`);
      case "error":
        return "";
      case "loading":
        return tGenres("list.loading");
      case "ready":
        return state.isRefreshing
          ? tGenres("list.loading")
          : tGenres("list.shown", { count: state.genres.length });
      default:
        return assertNever(state);
    }
  }

  function sidebarSlot(): ReactNode {
    if (overview.isPending) return <GenresInsightsSidebarSkeleton />;
    if (insights === null) return null;
    return <GenresInsightsSidebar overview={insights} />;
  }

  function toolbarSlot(state: GenresListState): ReactNode {
    if (list.data === undefined && list.isPending) return <GenresToolbarSkeleton />;
    if (state.kind === "error") return null;
    if (state.kind === "empty" && state.reason === "library") return null;
    return <GenresToolbar facets={facets.data} query={query} />;
  }
}
