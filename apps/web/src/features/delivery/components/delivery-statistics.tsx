"use client";

import type { BookOrderStatisticsView } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";
import { useId } from "react";

import type { LibrarySummaryCard } from "@/features/books/components/library-summary-cards";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

import type { StatisticsContent } from "./delivery-statistics-view";

import { useStatistics } from "../api/use-statistics";
import { formatCurrencyAverages, formatCurrencyTotals } from "../model/money-format";
import { hasAnyOrders, hasPricedData } from "../model/statistics-view-model";
import { useStatisticsParams } from "../model/use-statistics-params";
import { DeliveryOverviewPanel } from "./delivery-overview-panel";
import { DeliveryStatisticsFilters } from "./delivery-statistics-filters";
import { DeliveryStatisticsScreen } from "./delivery-statistics-view";
import { DeliverySummaryCards } from "./delivery-summary-cards";

export function DeliveryStatistics() {
  const tSummary = useTranslations("delivery.statistics.summary");
  const tControls = useTranslations("delivery.statistics.controls");
  const locale = useLocale();
  const toggleId = useId();

  const params = useStatisticsParams();
  const query = useStatistics(params.queryParams);
  const view = query.data;

  const content = resolveContent({
    hasActiveFilters: params.hasActiveFilters,
    isError: query.isError,
    view,
  });

  const summary = view?.summary;
  const mobileLabels = (
    key: "active" | "average" | "cancelled" | "orders" | "received" | "total",
  ) => ({
    compact: tSummary(`mobile.compact.${key}`),
    detailed: tSummary(`mobile.detailed.${key}`),
  });

  const summaryCards: LibrarySummaryCard[] = [
    {
      icon: "wallet",
      iconTone: "primary",
      label: tSummary("total"),
      mobileLabels: mobileLabels("total"),
      value: summary ? formatCurrencyTotals(summary.totalsByCurrency, locale) : "—",
    },
    {
      icon: "truck",
      iconTone: "info",
      label: tSummary("active"),
      mobileLabels: mobileLabels("active"),
      value: summary ? formatCurrencyTotals(summary.activeTotalsByCurrency, locale) : "—",
    },
    {
      icon: "check-circle",
      iconTone: "success",
      label: tSummary("received"),
      mobileLabels: mobileLabels("received"),
      value: summary ? formatCurrencyTotals(summary.receivedTotalsByCurrency, locale) : "—",
    },
    {
      icon: "x-circle",
      iconTone: "ink",
      label: tSummary("cancelled"),
      mobileLabels: mobileLabels("cancelled"),
      value: summary ? formatCurrencyTotals(summary.cancelledTotalsByCurrency, locale) : "—",
    },
    {
      icon: "chart",
      iconTone: "genre",
      label: tSummary("average"),
      mobileLabels: mobileLabels("average"),
      value: summary ? formatCurrencyAverages(summary.averageBookPriceByCurrency, locale) : "—",
    },
    {
      icon: "package",
      iconTone: "tag",
      label: tSummary("orders"),
      mobileLabels: mobileLabels("orders"),
      value: (summary?.ordersCount ?? 0).toLocaleString(locale),
    },
  ];

  return (
    <DeliveryStatisticsScreen
      content={content}
      controls={
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label
            className="flex cursor-pointer items-center gap-2.5 text-sm font-medium text-foreground"
            htmlFor={toggleId}
          >
            <Switch
              checked={params.state.includeCancelled}
              id={toggleId}
              onCheckedChange={params.setIncludeCancelled}
            />
            {tControls("includeCancelled")}
          </label>
          <div className="flex items-center gap-2">
            {params.hasActiveFilters ? (
              <Button onClick={params.clearFilters} size="sm" variant="ghost">
                {tControls("resetFilters")}
              </Button>
            ) : null}
            <DeliveryStatisticsFilters
              filterCount={params.filterCount}
              onApply={params.setFilters}
              onReset={params.clearFilters}
              state={params.state}
            />
          </div>
        </div>
      }
      onResetFilters={params.clearFilters}
      onRetry={() => void query.refetch()}
      summary={
        <DeliverySummaryCards
          cards={summaryCards}
          isLoading={view === undefined}
          mobileAction={
            <DeliveryOverviewPanel
              detailsTitle={tSummary("mobile.title")}
              isLoading={view === undefined}
              summaryCards={summaryCards}
            />
          }
        />
      }
    />
  );
}

function resolveContent({
  hasActiveFilters,
  isError,
  view,
}: {
  hasActiveFilters: boolean;
  isError: boolean;
  view: BookOrderStatisticsView | undefined;
}): StatisticsContent {
  if (isError) return { kind: "error" };
  if (view === undefined) return { kind: "loading" };
  if (!hasAnyOrders(view)) return { kind: hasActiveFilters ? "filtered-empty" : "empty" };
  if (!hasPricedData(view)) return { kind: "no-price" };
  return { kind: "ready", view };
}
