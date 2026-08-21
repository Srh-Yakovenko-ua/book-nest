"use client";

import { useTranslations } from "next-intl";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { type ReactNode, useState } from "react";

import type { LibrarySummaryCard } from "@/features/books/components/library-summary-cards";

import { type ActiveFilterChip, LibraryActiveFilters, useGenres } from "@/features/books";
import { useRouter } from "@/i18n/navigation";

import { useSeriesList } from "../api/use-series-list";
import { useSeriesOverview } from "../api/use-series-overview";
import {
  SERIES_LIST_LAYOUT_DEFAULT,
  SERIES_LIST_LAYOUTS,
  type SeriesAttentionReason,
  type SeriesReadingFilter,
  type SeriesStatusFilter,
} from "../model/series-derive";
import { toSeriesAdvancedFilters, toSeriesFilterPatch } from "../model/series-query";
import { useSeriesQuery } from "../model/use-series-query";
import { AllSeriesView } from "./all-series-view";
import { CreateSeriesDialog } from "./create-series-dialog";
import { SeriesOverviewPanel } from "./series-overview-panel";
import { SeriesSidebar } from "./series-sidebar";
import { SeriesToolbar } from "./series-toolbar";

const viewParser = parseAsStringLiteral(SERIES_LIST_LAYOUTS).withDefault(
  SERIES_LIST_LAYOUT_DEFAULT,
);

const EMPTY_ATTENTION_COUNTS: Record<SeriesAttentionReason, number> = {
  empty: 0,
  incomplete_data: 0,
  incomplete_set: 0,
  missing_parts: 0,
  next_unavailable: 0,
  unknown_status: 0,
};

export function AllSeries() {
  const t = useTranslations("series.summary");
  const tSeries = useTranslations("series");
  const tStatusFilter = useTranslations("series.statusFilter");
  const tReadingFilter = useTranslations("series.readingFilter");
  const tCompleteness = useTranslations("series.filters.completeness");
  const tAttention = useTranslations("series.attention");
  const router = useRouter();

  const seriesQuery = useSeriesQuery();
  const { data, isError, isPending, refetch } = useSeriesList(seriesQuery.listParams);
  const overview = useSeriesOverview();
  const genres = useGenres();

  const [view, setView] = useQueryState("view", viewParser);
  const [rememberedAuthorNames, setRememberedAuthorNames] = useState<Map<string, string>>(
    new Map(),
  );
  const [dialogOpen, setDialogOpen] = useState(false);

  const { state } = seriesQuery;
  const tab = state.tab;
  const search = state.q;
  const sort = state.sort;
  const attentionFilter = state.attention;
  const statusFilter: SeriesStatusFilter = state.status ?? "all";
  const readingFilter: SeriesReadingFilter = state.reading ?? "all";
  const advancedFilters = toSeriesAdvancedFilters(state);

  const setSearch = (value: string) => void seriesQuery.setState({ q: value });
  const setStatusFilter = (value: SeriesStatusFilter) =>
    void seriesQuery.setState({ status: value === "all" ? null : value });
  const setReadingFilter = (value: SeriesReadingFilter) =>
    void seriesQuery.setState({ reading: value === "all" ? null : value });
  const setAttentionFilter = (value: "any" | null | SeriesAttentionReason) =>
    void seriesQuery.setState({ attention: value });
  const setTab = (value: (typeof state)["tab"]) => void seriesQuery.setState({ tab: value });

  const visibleSeries = (data?.pages ?? []).flatMap((page) => page.items);
  const items = visibleSeries;
  const totalSeries = overview.data?.totalSeries ?? 0;
  const attentionCounts = overview.data?.attentionCounts ?? EMPTY_ATTENTION_COUNTS;
  const unfinishedCount = overview.data?.unfinishedSeries ?? 0;
  const almostReadSeries = overview.data?.almostRead ?? [];
  const hasAnySeries = totalSeries > 0 || items.length > 0;
  const hasActiveQuery = seriesQuery.hasActiveQuery;

  const authorNameById = new Map<string, string>();
  for (const series of items) {
    for (const author of series.authors) {
      if (!authorNameById.has(author.id)) authorNameById.set(author.id, author.name);
    }
  }

  const genreNameByKey = new Map((genres.data ?? []).map((genre) => [genre.key, genre.name]));

  function rememberAuthorName(id: string, name: string) {
    setRememberedAuthorNames((prev) => {
      if (prev.get(id) === name) return prev;
      const next = new Map(prev);
      next.set(id, name);
      return next;
    });
  }

  const resolveAuthorName = (id: string) => rememberedAuthorNames.get(id) ?? authorNameById.get(id);

  const overviewData = overview.data;

  const totalBreakdownMicrofact = ((): ReactNode => {
    if (overviewData === undefined || overviewData.totalSeries === 0) return undefined;
    return (
      <span className="block truncate">
        {t("totalBreakdown", {
          completed: overviewData.statusCounts.completed,
          ongoing: overviewData.statusCounts.ongoing,
        })}
      </span>
    );
  })();

  const fullyReadPercentMicrofact = ((): ReactNode => {
    if (overviewData === undefined || overviewData.totalSeries === 0) return undefined;
    const percent = Math.round((overviewData.fullyReadSeries / overviewData.totalSeries) * 100);
    return <span className="block truncate">{t("fullyReadPercent", { percent })}</span>;
  })();

  const booksLeftMicrofact = ((): ReactNode => {
    const n = overviewData?.booksLeftInUnfinishedSeries;
    if (!n) return undefined;
    return <span className="block truncate">{t("booksLeft", { n })}</span>;
  })();

  const booksReadOfTotalMicrofact = ((): ReactNode => {
    if (overviewData === undefined || overviewData.booksInSeries === 0) return undefined;
    const finished = overviewData.finishedBooksInSeries ?? 0;
    return (
      <span className="block truncate">
        {t("booksReadOfTotal", {
          finished: finished.toLocaleString(),
          total: overviewData.booksInSeries.toLocaleString(),
        })}
      </span>
    );
  })();

  const mobileLabels = (key: "booksInSeries" | "fullyRead" | "total" | "unfinished") => ({
    compact: t(`mobile.compact.${key}`),
    detailed: t(`mobile.detailed.${key}`),
  });

  const summaryCards: LibrarySummaryCard[] = [
    {
      icon: "layers",
      iconTone: "primary",
      label: t("total"),
      microfact: totalBreakdownMicrofact,
      mobileLabels: mobileLabels("total"),
      value: overview.data?.totalSeries ?? 0,
    },
    {
      icon: "check-circle",
      iconTone: "success",
      label: t("fullyRead"),
      microfact: fullyReadPercentMicrofact,
      mobileLabels: mobileLabels("fullyRead"),
      value: overview.data?.fullyReadSeries ?? 0,
    },
    {
      icon: "book",
      iconTone: "info",
      label: t("unfinished"),
      microfact: booksLeftMicrofact,
      mobileLabels: mobileLabels("unfinished"),
      value: overview.data?.unfinishedSeries ?? 0,
    },
    {
      icon: "library",
      iconTone: "primary",
      label: t("booksInSeries"),
      microfact: booksReadOfTotalMicrofact,
      mobileLabels: mobileLabels("booksInSeries"),
      value: overview.data?.booksInSeries ?? 0,
    },
  ];

  function clearFilters() {
    seriesQuery.clearAll();
  }

  const counterLabel = tSeries("counter", { shown: visibleSeries.length, total: totalSeries });

  const filterChips: ActiveFilterChip[] = [];

  if (search.trim() !== "") {
    filterChips.push({
      key: "search",
      label: tSeries("activeFilters.search", { query: search }),
      onRemove: () => setSearch(""),
    });
  }

  if (statusFilter !== "all") {
    filterChips.push({
      key: "status",
      label: tSeries("activeFilters.status", { label: tStatusFilter(statusFilter) }),
      onRemove: () => setStatusFilter("all"),
    });
  }

  if (readingFilter !== "all") {
    filterChips.push({
      key: "reading",
      label: tSeries("activeFilters.reading", { label: tReadingFilter(readingFilter) }),
      onRemove: () => setReadingFilter("all"),
    });
  }

  if (attentionFilter !== null) {
    filterChips.push({
      key: "attention",
      label: tSeries("activeFilters.attention", { label: tAttention(`chip.${attentionFilter}`) }),
      onRemove: () => setAttentionFilter(null),
    });
  }

  const progressLabel = rangeChipLabel({
    from: (min) => tSeries("activeFilters.progressFrom", { min }),
    max: advancedFilters.progressMax,
    min: advancedFilters.progressMin,
    range: (min, max) => tSeries("activeFilters.progressRange", { max, min }),
    to: (max) => tSeries("activeFilters.progressTo", { max }),
  });
  if (progressLabel !== null) {
    filterChips.push({
      key: "progress",
      label: progressLabel,
      onRemove: () => void seriesQuery.setState({ progressMax: null, progressMin: null }),
    });
  }

  const booksLabel = rangeChipLabel({
    from: (min) => tSeries("activeFilters.booksFrom", { min }),
    max: advancedFilters.booksMax,
    min: advancedFilters.booksMin,
    range: (min, max) => tSeries("activeFilters.booksRange", { max, min }),
    to: (max) => tSeries("activeFilters.booksTo", { max }),
  });
  if (booksLabel !== null) {
    filterChips.push({
      key: "books",
      label: booksLabel,
      onRemove: () => void seriesQuery.setState({ booksMax: null, booksMin: null }),
    });
  }

  for (const value of advancedFilters.completeness) {
    filterChips.push({
      key: `completeness:${value}`,
      label: tSeries("activeFilters.completeness", { label: tCompleteness(value) }),
      onRemove: () =>
        void seriesQuery.setState({
          completeness: withoutValue(advancedFilters.completeness, value),
        }),
    });
  }

  for (const key of advancedFilters.genres) {
    filterChips.push({
      key: `genre:${key}`,
      label: tSeries("activeFilters.genre", { name: genreNameByKey.get(key) ?? key }),
      onRemove: () =>
        void seriesQuery.setState({ genres: withoutValue(advancedFilters.genres, key) }),
    });
  }

  for (const id of advancedFilters.authorIds) {
    filterChips.push({
      key: `author:${id}`,
      label: tSeries("activeFilters.author", { name: resolveAuthorName(id) ?? id }),
      onRemove: () =>
        void seriesQuery.setState({ authorIds: withoutValue(advancedFilters.authorIds, id) }),
    });
  }

  return (
    <>
      <AllSeriesView
        activeFilters={<LibraryActiveFilters chips={filterChips} onClearAll={clearFilters} />}
        counterLabel={counterLabel}
        hasActiveQuery={hasActiveQuery}
        hasAnySeries={hasAnySeries}
        isError={isError}
        isPending={isPending}
        onAddBook={() => router.push("/books/new")}
        onClearFilters={clearFilters}
        onCreateSeries={() => setDialogOpen(true)}
        onOverviewRetry={() => void overview.refetch()}
        onRetry={() => void refetch()}
        onShowAll={() => setTab("all")}
        onTabChange={setTab}
        series={visibleSeries}
        sidebar={
          <SeriesSidebar
            activeAttention={attentionFilter}
            almostReadSeries={almostReadSeries}
            attentionCounts={attentionCounts}
            attentionLoading={isPending}
            isError={overview.isError}
            isLoading={overview.isPending}
            onAttentionSelect={setAttentionFilter}
            onRetry={() => void overview.refetch()}
            overview={overview.data}
          />
        }
        summaryCards={summaryCards}
        summaryError={overview.isError}
        summaryLoading={overview.isPending}
        summaryMobileAction={
          <SeriesOverviewPanel
            activeAttention={attentionFilter}
            almostReadSeries={almostReadSeries}
            attentionCounts={attentionCounts}
            attentionLoading={isPending}
            isError={overview.isError}
            isLoading={overview.isPending}
            onAttentionSelect={setAttentionFilter}
            onRetry={() => void overview.refetch()}
            overview={overview.data}
            summaryCards={summaryCards}
          />
        }
        tab={tab}
        toolbar={
          <SeriesToolbar
            advancedFilters={advancedFilters}
            onAdvancedApply={(next) => void seriesQuery.setState(toSeriesFilterPatch(next))}
            onReadingChange={setReadingFilter}
            onRememberAuthor={rememberAuthorName}
            onSearchChange={setSearch}
            onSearchClear={() => setSearch("")}
            onSortChange={(value) => void seriesQuery.setState({ sort: value })}
            onStatusChange={setStatusFilter}
            onViewChange={(value) => void setView(value)}
            readingFilter={readingFilter}
            resolveAuthorName={resolveAuthorName}
            search={search}
            sort={sort}
            statusFilter={statusFilter}
            view={view}
          />
        }
        unfinishedCount={unfinishedCount}
        view={view}
      />
      <CreateSeriesDialog onOpenChange={setDialogOpen} open={dialogOpen} />
    </>
  );
}

function rangeChipLabel({
  from,
  max,
  min,
  range,
  to,
}: {
  from: (value: number) => string;
  max: null | number;
  min: null | number;
  range: (min: number, max: number) => string;
  to: (value: number) => string;
}): null | string {
  if (min !== null && max !== null) return range(min, max);
  if (min !== null) return from(min);
  if (max !== null) return to(max);
  return null;
}

function withoutValue<Value extends string>(values: Value[], removed: Value): null | Value[] {
  const next = values.filter((value) => value !== removed);
  return next.length === 0 ? null : next;
}
