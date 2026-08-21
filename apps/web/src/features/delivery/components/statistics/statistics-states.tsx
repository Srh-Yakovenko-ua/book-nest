"use client";

import { useTranslations } from "next-intl";

import type { EmptyStateEntry } from "@/lib/empty-states";

import { EmptyState } from "@/components/empty-state";
import { UiIcon } from "@/components/icons";
import { Skeleton } from "@/components/ui/skeleton";

export function StatisticsEmpty({
  hasActiveFilters,
  onResetFilters,
}: {
  hasActiveFilters: boolean;
  onResetFilters: () => void;
}) {
  const t = useTranslations("delivery.statistics.states");

  if (hasActiveFilters) {
    const filteredState: EmptyStateEntry = {
      desc: t("filteredEmpty.description"),
      illu: "empty-search",
      primary: { icon: "x", label: t("filteredEmpty.reset") },
      title: t("filteredEmpty.title"),
    };
    return <EmptyState onPrimary={onResetFilters} state={filteredState} />;
  }

  const emptyState: EmptyStateEntry = {
    desc: t("empty.description"),
    illu: "empty-purchases",
    title: t("empty.title"),
  };
  return <EmptyState state={emptyState} />;
}

export function StatisticsError({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations("delivery.statistics.states");

  const errorState: EmptyStateEntry = {
    desc: t("error.description"),
    illu: "error-generic",
    primary: { icon: "refresh", label: t("error.retry") },
    title: t("error.title"),
  };

  return (
    <div aria-live="assertive" role="alert">
      <EmptyState onPrimary={onRetry} state={errorState} />
    </div>
  );
}

export function StatisticsSkeleton() {
  return (
    <div aria-busy className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton className="h-[8.5rem] w-full rounded-xl" key={index} />
        ))}
      </div>
      <Skeleton className="h-28 w-full rounded-xl" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Skeleton className="h-[26rem] w-full rounded-xl lg:col-span-2" />
        <Skeleton className="h-[26rem] w-full rounded-xl" />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    </div>
  );
}

export function StatisticsTruncationNotice({
  loadedOrdersCount,
  maxOrders,
}: {
  loadedOrdersCount: number;
  maxOrders: number;
}) {
  const t = useTranslations("delivery.statistics.states");

  return (
    <p
      className="flex items-start gap-2 rounded-lg border border-favorite/30 bg-favorite-soft px-3 py-2 text-sm text-favorite"
      role="status"
    >
      <UiIcon className="mt-0.5 shrink-0" name="alert-triangle" size={16} />
      {t("truncated", { loaded: loadedOrdersCount, max: maxOrders })}
    </p>
  );
}
