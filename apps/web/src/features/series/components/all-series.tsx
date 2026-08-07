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
  countSeriesAttention,
  EMPTY_SERIES_ADVANCED_FILTERS,
  filterSeries,
  hasActiveSeriesFilters,
  isSeriesUnfinished,
  selectAlmostReadSeries,
  SERIES_LIST_LAYOUT_DEFAULT,
  SERIES_LIST_LAYOUTS,
  SERIES_SORT_DEFAULT,
  SERIES_TABS,
  type SeriesAdvancedFilters,
  type SeriesAttentionFilter,
  type SeriesReadingFilter,
  type SeriesSort,
  type SeriesStatusFilter,
  sortSeries,
} from "../model/series-derive";
import { AllSeriesView } from "./all-series-view";
import { CreateSeriesDialog } from "./create-series-dialog";
import { SeriesOverviewPanel } from "./series-overview-panel";
import { SeriesSidebar } from "./series-sidebar";
import { SeriesToolbar } from "./series-toolbar";

const tabParser = parseAsStringLiteral(SERIES_TABS).withDefault("all");
const viewParser = parseAsStringLiteral(SERIES_LIST_LAYOUTS).withDefault(
  SERIES_LIST_LAYOUT_DEFAULT,
);

export function AllSeries() {
  const t = useTranslations("series.summary");
  const tSeries = useTranslations("series");
  const tStatusFilter = useTranslations("series.statusFilter");
  const tReadingFilter = useTranslations("series.readingFilter");
  const tCompleteness = useTranslations("series.filters.completeness");
  const tAttention = useTranslations("series.attention");
  const router = useRouter();

  const { data, isError, isPending, refetch } = useSeriesList();
  const overview = useSeriesOverview();
  const genres = useGenres();

  const [tab, setTab] = useQueryState("tab", tabParser);
  const [view, setView] = useQueryState("view", viewParser);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<SeriesStatusFilter>("all");
  const [readingFilter, setReadingFilter] = useState<SeriesReadingFilter>("all");
  const [attentionFilter, setAttentionFilter] = useState<null | SeriesAttentionFilter>(null);
  const [sort, setSort] = useState<SeriesSort>(SERIES_SORT_DEFAULT);
  const [advancedFilters, setAdvancedFilters] = useState<SeriesAdvancedFilters>(
    EMPTY_SERIES_ADVANCED_FILTERS,
  );
  const [rememberedAuthorNames, setRememberedAuthorNames] = useState<Map<string, string>>(
    new Map(),
  );
  const [dialogOpen, setDialogOpen] = useState(false);

  const items = (data?.pages ?? []).flatMap((page) => page.items);
  const visibleSeries = sortSeries({
    items: filterSeries({
      advanced: advancedFilters,
      attention: attentionFilter,
      items,
      readingFilter,
      search,
      statusFilter,
      tab,
    }),
    sort,
  });
  const attentionCounts = countSeriesAttention(items);
  const unfinishedCount = items.filter(isSeriesUnfinished).length;
  const almostReadSeries = selectAlmostReadSeries({
    excludeId: overview.data?.topUnfinished[0]?.id,
    items,
  });
  const hasAnySeries = items.length > 0 || (overview.data?.totalSeries ?? 0) > 0;
  const hasActiveQuery =
    search.trim() !== "" ||
    statusFilter !== "all" ||
    readingFilter !== "all" ||
    attentionFilter !== null ||
    hasActiveSeriesFilters(advancedFilters);

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
    setSearch("");
    setStatusFilter("all");
    setReadingFilter("all");
    setAttentionFilter(null);
    setAdvancedFilters(EMPTY_SERIES_ADVANCED_FILTERS);
  }

  const counterLabel = tSeries("counter", { shown: visibleSeries.length, total: items.length });

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
      onRemove: () =>
        setAdvancedFilters((prev) => ({ ...prev, progressMax: null, progressMin: null })),
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
      onRemove: () => setAdvancedFilters((prev) => ({ ...prev, booksMax: null, booksMin: null })),
    });
  }

  for (const value of advancedFilters.completeness) {
    filterChips.push({
      key: `completeness:${value}`,
      label: tSeries("activeFilters.completeness", { label: tCompleteness(value) }),
      onRemove: () =>
        setAdvancedFilters((prev) => ({
          ...prev,
          completeness: prev.completeness.filter((item) => item !== value),
        })),
    });
  }

  for (const key of advancedFilters.genres) {
    filterChips.push({
      key: `genre:${key}`,
      label: tSeries("activeFilters.genre", { name: genreNameByKey.get(key) ?? key }),
      onRemove: () =>
        setAdvancedFilters((prev) => ({
          ...prev,
          genres: prev.genres.filter((item) => item !== key),
        })),
    });
  }

  for (const id of advancedFilters.authorIds) {
    filterChips.push({
      key: `author:${id}`,
      label: tSeries("activeFilters.author", { name: resolveAuthorName(id) ?? id }),
      onRemove: () =>
        setAdvancedFilters((prev) => ({
          ...prev,
          authorIds: prev.authorIds.filter((item) => item !== id),
        })),
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
        onShowAll={() => void setTab("all")}
        onTabChange={(value) => void setTab(value)}
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
            onAdvancedApply={setAdvancedFilters}
            onReadingChange={setReadingFilter}
            onRememberAuthor={rememberAuthorName}
            onSearchChange={setSearch}
            onSearchClear={() => setSearch("")}
            onSortChange={setSort}
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
