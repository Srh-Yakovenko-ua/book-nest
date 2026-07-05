"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { useRouter } from "@/i18n/navigation";

import type { SeriesSummaryCard } from "./series-summary-cards";

import { useSeriesList } from "../api/use-series-list";
import { useSeriesOverview } from "../api/use-series-overview";
import {
  filterSeries,
  isSeriesUnfinished,
  SERIES_SORT_DEFAULT,
  type SeriesReadingFilter,
  type SeriesSort,
  type SeriesStatusFilter,
  type SeriesTab,
  sortSeries,
} from "../model/series-derive";
import { AllSeriesView } from "./all-series-view";
import { CreateSeriesDialog } from "./create-series-dialog";
import { SeriesSidebar } from "./series-sidebar";
import { SeriesToolbar } from "./series-toolbar";

export function AllSeries() {
  const t = useTranslations("series.summary");
  const router = useRouter();

  const { data, isError, isPending, refetch } = useSeriesList();
  const overview = useSeriesOverview();

  const [tab, setTab] = useState<SeriesTab>("all");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<SeriesStatusFilter>("all");
  const [readingFilter, setReadingFilter] = useState<SeriesReadingFilter>("all");
  const [sort, setSort] = useState<SeriesSort>(SERIES_SORT_DEFAULT);
  const [dialogOpen, setDialogOpen] = useState(false);

  const items = (data?.pages ?? []).flatMap((page) => page.items);
  const visibleSeries = sortSeries({
    items: filterSeries({ items, readingFilter, search, statusFilter, tab }),
    sort,
  });
  const unfinishedCount = items.filter(isSeriesUnfinished).length;
  const totalCount = overview.data?.totalSeries ?? items.length;
  const hasAnySeries = items.length > 0 || (overview.data?.totalSeries ?? 0) > 0;
  const hasActiveQuery = search.trim() !== "" || statusFilter !== "all" || readingFilter !== "all";

  const summaryCards: SeriesSummaryCard[] = [
    { icon: "layers", label: t("total"), value: overview.data?.totalSeries ?? 0 },
    { icon: "check-circle", label: t("fullyRead"), value: overview.data?.fullyReadSeries ?? 0 },
    { icon: "book", label: t("unfinished"), value: overview.data?.unfinishedSeries ?? 0 },
    { icon: "library", label: t("booksInSeries"), value: overview.data?.booksInSeries ?? 0 },
  ];

  function clearFilters() {
    setSearch("");
    setStatusFilter("all");
    setReadingFilter("all");
  }

  return (
    <>
      <AllSeriesView
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
            isError={overview.isError}
            isLoading={overview.isPending}
            onCreateSeries={() => setDialogOpen(true)}
            onGoToUnfinished={() => setTab("unfinished")}
            onRetry={() => void overview.refetch()}
            overview={overview.data}
          />
        }
        summaryCards={summaryCards}
        summaryError={overview.isError}
        summaryLoading={overview.isPending}
        tab={tab}
        toolbar={
          <SeriesToolbar
            onReadingChange={setReadingFilter}
            onSearchChange={setSearch}
            onSearchClear={() => setSearch("")}
            onSortChange={setSort}
            onStatusChange={setStatusFilter}
            readingFilter={readingFilter}
            search={search}
            sort={sort}
            statusFilter={statusFilter}
          />
        }
        totalCount={totalCount}
        unfinishedCount={unfinishedCount}
      />
      <CreateSeriesDialog onOpenChange={setDialogOpen} open={dialogOpen} />
    </>
  );
}
