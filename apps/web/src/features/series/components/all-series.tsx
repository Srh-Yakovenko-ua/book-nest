"use client";

import { useTranslations } from "next-intl";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { type ReactNode, useState } from "react";

import { useRouter } from "@/i18n/navigation";

import type { SeriesSummaryCard } from "./series-summary-cards";

import { useSeriesList } from "../api/use-series-list";
import { useSeriesOverview } from "../api/use-series-overview";
import {
  filterSeries,
  isSeriesUnfinished,
  SERIES_SORT_DEFAULT,
  SERIES_TABS,
  type SeriesReadingFilter,
  type SeriesSort,
  type SeriesStatusFilter,
  sortSeries,
} from "../model/series-derive";
import { AllSeriesView } from "./all-series-view";
import { CreateSeriesDialog } from "./create-series-dialog";
import { SeriesSidebar } from "./series-sidebar";
import { SeriesToolbar } from "./series-toolbar";

const tabParser = parseAsStringLiteral(SERIES_TABS).withDefault("all");

export function AllSeries() {
  const t = useTranslations("series.summary");
  const router = useRouter();

  const { data, isError, isPending, refetch } = useSeriesList();
  const overview = useSeriesOverview();

  const [tab, setTab] = useQueryState("tab", tabParser);
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
  const hasAnySeries = items.length > 0 || (overview.data?.totalSeries ?? 0) > 0;
  const hasActiveQuery = search.trim() !== "" || statusFilter !== "all" || readingFilter !== "all";

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

  const summaryCards: SeriesSummaryCard[] = [
    {
      icon: "layers",
      iconTone: "primary",
      label: t("total"),
      microfact: totalBreakdownMicrofact,
      value: overview.data?.totalSeries ?? 0,
    },
    {
      icon: "check-circle",
      iconTone: "success",
      label: t("fullyRead"),
      microfact: fullyReadPercentMicrofact,
      value: overview.data?.fullyReadSeries ?? 0,
    },
    {
      icon: "book",
      iconTone: "info",
      label: t("unfinished"),
      microfact: booksLeftMicrofact,
      value: overview.data?.unfinishedSeries ?? 0,
    },
    {
      icon: "library",
      iconTone: "primary",
      label: t("booksInSeries"),
      microfact: booksReadOfTotalMicrofact,
      value: overview.data?.booksInSeries ?? 0,
    },
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
        onShowAll={() => void setTab("all")}
        onTabChange={(value) => void setTab(value)}
        series={visibleSeries}
        sidebar={
          <SeriesSidebar
            isError={overview.isError}
            isLoading={overview.isPending}
            onCreateSeries={() => setDialogOpen(true)}
            onGoToUnfinished={() => void setTab("unfinished")}
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
        unfinishedCount={unfinishedCount}
      />
      <CreateSeriesDialog onOpenChange={setDialogOpen} open={dialogOpen} />
    </>
  );
}
