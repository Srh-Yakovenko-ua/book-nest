"use client";

import type { BookOrderStatisticsView, Nullable } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";
import dynamic from "next/dynamic";

import { TitleLeaf } from "@/components/title-leaf";
import { Skeleton } from "@/components/ui/skeleton";

import type { StatisticsSectionCurrencies } from "../model/statistics-section-currency";

import { useActiveMoneyAge } from "../api/use-active-money-age";
import { useBookBudgets } from "../api/use-book-budgets";
import { useStatistics } from "../api/use-statistics";
import { resolveMoneyCurrency, statisticsCurrencies } from "../model/statistics-currency";
import { formatPeriodRange } from "../model/statistics-format";
import { sectionCurrencyControl } from "../model/statistics-section-currency";
import { hasAnyOrders } from "../model/statistics-view-model";
import { useStatisticsParams } from "../model/use-statistics-params";
import { StatisticsActiveAge } from "./statistics/statistics-active-age";
import { StatisticsBudget } from "./statistics/statistics-budget";
import { StatisticsCosts } from "./statistics/statistics-costs";
import { StatisticsKpi } from "./statistics/statistics-kpi";
import { StatisticsLifecycle } from "./statistics/statistics-lifecycle";
import { StatisticsPulse } from "./statistics/statistics-pulse";
import { StatisticsRecords } from "./statistics/statistics-records";
import {
  StatisticsEmpty,
  StatisticsError,
  StatisticsSkeleton,
  StatisticsTruncationNotice,
} from "./statistics/statistics-states";
import { StatisticsStores } from "./statistics/statistics-stores";
import { StatisticsToolbar } from "./statistics/statistics-toolbar";
import { StatisticsTopOrders } from "./statistics/statistics-top-orders";

const StatisticsDynamics = dynamic(
  () => import("./statistics/statistics-dynamics").then((m) => m.StatisticsDynamics),
  { loading: () => <Skeleton className="h-[26rem] w-full rounded-xl" />, ssr: false },
);

const StatisticsStoreMap = dynamic(
  () => import("./statistics/statistics-store-map").then((m) => m.StatisticsStoreMap),
  { loading: () => <Skeleton className="h-[24rem] w-full rounded-xl" />, ssr: false },
);

const StatisticsCalendar = dynamic(
  () => import("./statistics/statistics-calendar").then((m) => m.StatisticsCalendar),
  { loading: () => <Skeleton className="h-64 w-full rounded-xl" />, ssr: false },
);

type StatisticsBodyProps = {
  activeAge: ReturnType<typeof useActiveMoneyAge>;
  budgets: ReturnType<typeof useBookBudgets>;
  comparisonLabel: Nullable<string>;
  comparisonView: Nullable<BookOrderStatisticsView>;
  costsBudget: Nullable<NonNullable<ReturnType<typeof useBookBudgets>["data"]>["budgets"][number]>;
  currencies: ReturnType<typeof statisticsCurrencies>;
  currentLabel: Nullable<string>;
  dashboardCurrency: ReturnType<typeof resolveMoneyCurrency>;
  drilldown: {
    currency: Nullable<ReturnType<typeof resolveMoneyCurrency>>;
    store: Nullable<string>;
  };
  isCurrentMonthPeriod: boolean;
  params: ReturnType<typeof useStatisticsParams>;
  sectionCurrencies: StatisticsSectionCurrencies;
  statistics: ReturnType<typeof useStatistics>;
  view: BookOrderStatisticsView | undefined;
};

export function DeliveryStatistics() {
  const t = useTranslations("delivery.statistics");
  const locale = useLocale();
  const params = useStatisticsParams();

  const statistics = useStatistics(params.queryParams);
  const view = statistics.data;
  const comparisonPeriod = view?.meta.comparisonPeriod ?? null;

  const comparison = useStatistics(
    {
      ...params.queryParams,
      compare: undefined,
      from: comparisonPeriod?.from,
      to: comparisonPeriod?.to,
    },
    { enabled: comparisonPeriod !== null },
  );

  const activeAge = useActiveMoneyAge({
    ...(params.state.currency === null ? {} : { currency: params.state.currency }),
    ...(params.state.store.trim() === "" ? {} : { store: params.state.store.trim() }),
  });
  const budgets = useBookBudgets();

  const currencies = view === undefined ? [] : statisticsCurrencies(view);
  const dashboardCurrency = resolveMoneyCurrency({
    available: currencies,
    preferred: params.state.money ?? params.state.currency,
  });
  const budgetCurrencies = budgets.data?.budgets.map((entry) => entry.currency) ?? [];

  const sectionCurrencies: StatisticsSectionCurrencies = {
    budget: sectionCurrencyControl({
      available: budgetCurrencies,
      commit: (moneyBudget) => params.setSectionMoney({ moneyBudget }),
      dashboardCurrency,
      override: params.state.moneyBudget,
    }),
    costs: sectionCurrencyControl({
      available: currencies,
      commit: (moneyCosts) => params.setSectionMoney({ moneyCosts }),
      dashboardCurrency,
      override: params.state.moneyCosts,
    }),
    dynamics: sectionCurrencyControl({
      available: currencies,
      commit: (moneyDynamics) => params.setSectionMoney({ moneyDynamics }),
      dashboardCurrency,
      override: params.state.moneyDynamics,
    }),
    records: sectionCurrencyControl({
      available: currencies,
      commit: (moneyRecords) => params.setSectionMoney({ moneyRecords }),
      dashboardCurrency,
      override: params.state.moneyRecords,
    }),
    stores: sectionCurrencyControl({
      available: currencies,
      commit: (moneyStores) => params.setSectionMoney({ moneyStores }),
      dashboardCurrency,
      override: params.state.moneyStores,
    }),
    topOrders: sectionCurrencyControl({
      available: currencies,
      commit: (moneyTopOrders) => params.setSectionMoney({ moneyTopOrders }),
      dashboardCurrency,
      override: params.state.moneyTopOrders,
    }),
  };

  const drilldown = {
    currency: params.state.currency,
    store: params.state.store.trim() === "" ? null : params.state.store.trim(),
  };

  const currentLabel = formatPeriodRange({
    from: view?.meta.currentPeriod.from ?? null,
    locale,
    to: view?.meta.currentPeriod.to ?? null,
  });
  const comparisonLabel =
    comparisonPeriod === null
      ? null
      : formatPeriodRange({ from: comparisonPeriod.from, locale, to: comparisonPeriod.to });

  const costsBudget =
    budgets.data?.budgets.find((entry) => entry.currency === sectionCurrencies.costs.value) ?? null;
  const isCurrentMonthPeriod = params.state.period === "this_month";

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1 motion-safe:animate-in motion-safe:duration-500 motion-safe:fill-mode-both motion-safe:fade-in motion-safe:slide-in-from-bottom-1">
        <div className="flex items-center gap-3">
          <h1 className="font-heading text-[clamp(1.75rem,3.5vw,2.5rem)] leading-tight font-semibold text-ink">
            {t("title")}
          </h1>
          <TitleLeaf />
        </div>
        <p className="max-w-2xl text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>

      <StatisticsToolbar meta={view?.meta ?? null} params={params} />

      {view !== undefined && view.meta.isTruncated && view.meta.maxOrders !== null ? (
        <StatisticsTruncationNotice
          loadedOrdersCount={view.meta.loadedOrdersCount}
          maxOrders={view.meta.maxOrders}
        />
      ) : null}

      <StatisticsBody
        activeAge={activeAge}
        budgets={budgets}
        comparisonLabel={comparisonLabel}
        comparisonView={comparisonPeriod === null ? null : (comparison.data ?? null)}
        costsBudget={costsBudget}
        currencies={currencies}
        currentLabel={currentLabel}
        dashboardCurrency={dashboardCurrency}
        drilldown={drilldown}
        isCurrentMonthPeriod={isCurrentMonthPeriod}
        params={params}
        sectionCurrencies={sectionCurrencies}
        statistics={statistics}
        view={view}
      />
    </div>
  );
}

function StatisticsBody({
  activeAge,
  budgets,
  comparisonLabel,
  comparisonView,
  costsBudget,
  currencies,
  currentLabel,
  dashboardCurrency,
  drilldown,
  isCurrentMonthPeriod,
  params,
  sectionCurrencies,
  statistics,
  view,
}: StatisticsBodyProps) {
  if (statistics.isError) {
    return <StatisticsError onRetry={() => void statistics.refetch()} />;
  }

  if (view === undefined) {
    return <StatisticsSkeleton />;
  }

  if (!hasAnyOrders(view)) {
    return (
      <div className="flex flex-col gap-6">
        <StatisticsEmpty
          hasActiveFilters={params.hasActiveFilters}
          onResetFilters={params.clearFilters}
        />
        <StatisticsActiveAge
          data={activeAge.data}
          drilldown={drilldown}
          isLoading={activeAge.isPending}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <StatisticsKpi currency={dashboardCurrency} snapshot={view.snapshot} view={view} />

      <StatisticsBudget
        currency={sectionCurrencies.budget.value}
        isLoading={budgets.isPending}
        onCurrencyChange={sectionCurrencies.budget.onChange}
        overview={budgets.data}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <StatisticsDynamics
            comparisonLabel={comparisonLabel}
            comparisonMonths={comparisonView?.monthly ?? null}
            currencies={currencies}
            currency={sectionCurrencies.dynamics.value}
            currentLabel={currentLabel}
            drilldown={drilldown}
            months={view.monthly}
            onCurrencyChange={sectionCurrencies.dynamics.onChange}
            range={view.meta.currentPeriod}
          />
        </div>
        <StatisticsPulse comparisonLabel={comparisonLabel} pulse={view.pulse} />
      </div>

      <StatisticsCosts
        currencies={currencies}
        currency={sectionCurrencies.costs.value}
        deliveryShareOfBudgetPercent={
          isCurrentMonthPeriod
            ? (costsBudget?.currentMonth?.deliveryShareOfBudgetPercent ?? null)
            : null
        }
        onCurrencyChange={sectionCurrencies.costs.onChange}
        view={view}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <StatisticsLifecycle lifecycle={view.lifecycle} />
        <StatisticsActiveAge
          data={activeAge.data}
          drilldown={drilldown}
          isLoading={activeAge.isPending}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <StatisticsStores
          comparisonStores={comparisonView?.byStore ?? null}
          currencies={currencies}
          currency={sectionCurrencies.stores.value}
          drilldown={drilldown}
          onCurrencyChange={sectionCurrencies.stores.onChange}
          stores={view.byStore}
        />
        <StatisticsStoreMap
          currencies={currencies}
          currency={sectionCurrencies.stores.value}
          drilldown={drilldown}
          onCurrencyChange={sectionCurrencies.stores.onChange}
          stores={view.byStore}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <StatisticsCalendar daily={view.daily} drilldown={drilldown} today={params.today} />
        <StatisticsRecords
          currencies={currencies}
          currency={sectionCurrencies.records.value}
          drilldown={drilldown}
          onCurrencyChange={sectionCurrencies.records.onChange}
          records={view.records}
        />
      </div>

      <StatisticsTopOrders
        currencies={currencies}
        currency={sectionCurrencies.topOrders.value}
        onCurrencyChange={sectionCurrencies.topOrders.onChange}
        topOrdersByCurrency={view.topOrdersByCurrency}
      />
    </div>
  );
}
