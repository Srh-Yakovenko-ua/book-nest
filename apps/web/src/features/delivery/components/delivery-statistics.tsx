"use client";

import type { DeliveryStatisticsView } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";
import { useId } from "react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

import type { StatisticsContent } from "./delivery-statistics-view";
import type { DeliverySummaryCard } from "./delivery-summary-cards";

import { useStatistics } from "../api/use-statistics";
import { formatCurrencyAverages, formatCurrencyTotals } from "../model/money-format";
import { hasAnyOrders, hasPricedData } from "../model/statistics-view-model";
import { useStatisticsParams } from "../model/use-statistics-params";
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
  const summaryCards: DeliverySummaryCard[] = [
    {
      icon: "wallet",
      label: tSummary("total"),
      value: summary ? formatCurrencyTotals(summary.totalByCurrency, locale) : "—",
    },
    {
      icon: "truck",
      label: tSummary("active"),
      value: summary ? formatCurrencyTotals(summary.activeByCurrency, locale) : "—",
    },
    {
      icon: "check-circle",
      label: tSummary("received"),
      value: summary ? formatCurrencyTotals(summary.receivedByCurrency, locale) : "—",
    },
    {
      icon: "x-circle",
      label: tSummary("cancelled"),
      value: summary ? formatCurrencyTotals(summary.cancelledByCurrency, locale) : "—",
    },
    {
      icon: "chart",
      label: tSummary("average"),
      value: summary ? formatCurrencyAverages(summary.averageByCurrency, locale) : "—",
    },
    {
      icon: "package",
      label: tSummary("pricedOrders"),
      value: (summary?.pricedOrdersCount ?? 0).toLocaleString(locale),
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
      summary={<DeliverySummaryCards cards={summaryCards} isLoading={view === undefined} />}
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
  view: DeliveryStatisticsView | undefined;
}): StatisticsContent {
  if (isError) return { kind: "error" };
  if (view === undefined) return { kind: "loading" };
  if (!hasAnyOrders(view)) return { kind: hasActiveFilters ? "filtered-empty" : "empty" };
  if (!hasPricedData(view)) return { kind: "no-price" };
  return { kind: "ready", view };
}
