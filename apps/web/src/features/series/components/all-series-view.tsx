"use client";

import type { SeriesView } from "@app/shared";
import type { ReactNode } from "react";

import { useTranslations } from "next-intl";

import type { EmptyStateEntry } from "@/lib/empty-states";

import { EmptyState } from "@/components/empty-state";
import { UiIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import type { SeriesTab } from "../model/series-derive";
import type { SeriesSummaryCard } from "./series-summary-cards";

import { SeriesCard } from "./series-card";
import { SeriesSummaryCards } from "./series-summary-cards";

const SKELETON_COUNT = 6;

type AllSeriesViewProps = {
  hasActiveQuery: boolean;
  hasAnySeries: boolean;
  isError: boolean;
  isPending: boolean;
  onAddBook: () => void;
  onClearFilters: () => void;
  onCreateSeries: () => void;
  onOverviewRetry: () => void;
  onRetry: () => void;
  onShowAll: () => void;
  onTabChange: (tab: SeriesTab) => void;
  series: SeriesView[];
  sidebar: ReactNode;
  summaryCards: SeriesSummaryCard[];
  summaryError: boolean;
  summaryLoading: boolean;
  tab: SeriesTab;
  toolbar: ReactNode;
  totalCount: number;
  unfinishedCount: number;
};

export function AllSeriesView({
  hasActiveQuery,
  hasAnySeries,
  isError,
  isPending,
  onAddBook,
  onClearFilters,
  onCreateSeries,
  onOverviewRetry,
  onRetry,
  onShowAll,
  onTabChange,
  series,
  sidebar,
  summaryCards,
  summaryError,
  summaryLoading,
  tab,
  toolbar,
  totalCount,
  unfinishedCount,
}: AllSeriesViewProps) {
  const t = useTranslations("series");
  const showToolbar = !isError && (isPending || hasAnySeries);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-6 motion-safe:animate-in motion-safe:duration-500 motion-safe:fill-mode-both motion-safe:fade-in motion-safe:slide-in-from-bottom-1">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <h1 className="font-heading text-[clamp(1.75rem,3.5vw,2.5rem)] leading-tight font-semibold text-ink">
                {t("page.title")}
              </h1>
              <Badge variant="secondary">{t("page.count", { count: totalCount })}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{t("page.subtitle")}</p>
          </div>
          <Button className="self-start sm:self-auto" onClick={onCreateSeries}>
            <UiIcon name="plus" size={16} />
            {t("page.create")}
          </Button>
        </div>

        <SeriesSummaryCards
          cards={summaryCards}
          isError={summaryError}
          isLoading={summaryLoading}
          onRetry={onOverviewRetry}
        />
      </header>

      {showToolbar ? (
        <div className="flex flex-col gap-4">
          <Tabs onValueChange={(value) => onTabChange(value as SeriesTab)} value={tab}>
            <TabsList>
              <TabsTrigger value="all">{t("tabs.all")}</TabsTrigger>
              <TabsTrigger value="unfinished">
                {t("tabs.unfinished")}
                <Badge variant="secondary">{unfinishedCount}</Badge>
              </TabsTrigger>
            </TabsList>
          </Tabs>
          {toolbar}
        </div>
      ) : null}

      <div className="flex flex-col gap-8 xl:flex-row xl:items-start xl:gap-6">
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <h2 className="sr-only">{t("page.resultsTitle")}</h2>
          <SeriesContent
            hasActiveQuery={hasActiveQuery}
            hasAnySeries={hasAnySeries}
            isError={isError}
            isPending={isPending}
            onAddBook={onAddBook}
            onClearFilters={onClearFilters}
            onCreateSeries={onCreateSeries}
            onRetry={onRetry}
            onShowAll={onShowAll}
            series={series}
            tab={tab}
          />
        </div>
        {showToolbar ? sidebar : null}
      </div>
    </div>
  );
}

function SeriesCardSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-card">
      <div className="flex gap-3.5">
        <Skeleton className="aspect-[3/4] w-[74px] shrink-0 rounded-md" />
        <div className="flex flex-1 flex-col gap-2 pt-1">
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="mt-1 h-5 w-24 rounded-full" />
        </div>
      </div>
      <Skeleton className="h-1.5 w-full rounded-full" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  );
}

function SeriesContent({
  hasActiveQuery,
  hasAnySeries,
  isError,
  isPending,
  onAddBook,
  onClearFilters,
  onCreateSeries,
  onRetry,
  onShowAll,
  series,
  tab,
}: {
  hasActiveQuery: boolean;
  hasAnySeries: boolean;
  isError: boolean;
  isPending: boolean;
  onAddBook: () => void;
  onClearFilters: () => void;
  onCreateSeries: () => void;
  onRetry: () => void;
  onShowAll: () => void;
  series: SeriesView[];
  tab: SeriesTab;
}) {
  const t = useTranslations("series.states");

  const emptyState: EmptyStateEntry = {
    desc: t("empty.description"),
    illu: "empty-series",
    primary: { icon: "plus", label: t("empty.create") },
    secondary: { icon: "book", label: t("empty.addBook") },
    title: t("empty.title"),
  };

  if (isError) {
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
  }

  if (isPending) {
    return <SeriesGridSkeleton />;
  }

  if (series.length === 0) {
    if (!hasAnySeries) {
      return <EmptyState onPrimary={onCreateSeries} onSecondary={onAddBook} state={emptyState} />;
    }
    if (tab === "unfinished" && !hasActiveQuery) {
      return (
        <EmptyState
          onPrimary={onShowAll}
          state={{
            desc: t("emptyUnfinished.description"),
            illu: "empty-queue",
            primary: { icon: "layers", label: t("emptyUnfinished.showAll") },
            title: t("emptyUnfinished.title"),
          }}
        />
      );
    }
    return (
      <EmptyState
        onPrimary={onClearFilters}
        state={{
          desc: t("noResults.description"),
          illu: "empty-search",
          primary: { icon: "x", label: t("noResults.clear") },
          title: t("noResults.title"),
        }}
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {series.map((item) => (
        <SeriesCard key={item.id} series={item} />
      ))}
    </div>
  );
}

function SeriesGridSkeleton() {
  return (
    <div aria-busy className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: SKELETON_COUNT }, (_, index) => (
        <SeriesCardSkeleton key={index} />
      ))}
    </div>
  );
}
