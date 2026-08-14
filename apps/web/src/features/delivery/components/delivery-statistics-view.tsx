"use client";

import type { BookOrderStatisticsView } from "@app/shared";
import type { ReactNode } from "react";

import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";

import type { EmptyStateEntry } from "@/lib/empty-states";

import { EmptyState } from "@/components/empty-state";
import { TitleLeaf } from "@/components/title-leaf";
import { Skeleton } from "@/components/ui/skeleton";

import {
  DeliveryStatusBreakdown,
  DeliveryStoreBreakdown,
  DeliveryTopOrders,
} from "./delivery-stat-breakdowns";

const DeliveryMonthlyChart = dynamic(
  () => import("./delivery-monthly-chart").then((m) => m.DeliveryMonthlyChart),
  {
    loading: () => <Skeleton className="h-80 w-full rounded-xl" />,
    ssr: false,
  },
);

export type StatisticsContent =
  | { kind: "empty" }
  | { kind: "error" }
  | { kind: "filtered-empty" }
  | { kind: "loading" }
  | { kind: "no-price" }
  | { kind: "ready"; view: BookOrderStatisticsView };

type DeliveryStatisticsViewProps = {
  content: StatisticsContent;
  controls: ReactNode;
  onResetFilters: () => void;
  onRetry: () => void;
  summary: ReactNode;
};

export function DeliveryStatisticsScreen({
  content,
  controls,
  onResetFilters,
  onRetry,
  summary,
}: DeliveryStatisticsViewProps) {
  const t = useTranslations("delivery.statistics");
  const showSummary =
    content.kind === "loading" || content.kind === "no-price" || content.kind === "ready";

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-6 motion-safe:animate-in motion-safe:duration-500 motion-safe:fill-mode-both motion-safe:fade-in motion-safe:slide-in-from-bottom-1">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <h1 className="font-heading text-[clamp(1.75rem,3.5vw,2.5rem)] leading-tight font-semibold text-ink">
              {t("title")}
            </h1>
            <TitleLeaf />
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
      </header>

      {controls}

      {showSummary ? summary : null}

      <StatisticsContentArea content={content} onResetFilters={onResetFilters} onRetry={onRetry} />
    </div>
  );
}

function StatisticsContentArea({
  content,
  onResetFilters,
  onRetry,
}: Pick<DeliveryStatisticsViewProps, "content" | "onResetFilters" | "onRetry">) {
  const t = useTranslations("delivery.statistics");

  if (content.kind === "error") {
    const errorState: EmptyStateEntry = {
      desc: t("states.error.description"),
      illu: "error-generic",
      primary: { icon: "refresh", label: t("states.error.retry") },
      title: t("states.error.title"),
    };
    return (
      <div aria-live="assertive" role="alert">
        <EmptyState onPrimary={onRetry} state={errorState} />
      </div>
    );
  }

  if (content.kind === "loading") {
    return <StatisticsSkeleton />;
  }

  if (content.kind === "empty") {
    const emptyState: EmptyStateEntry = {
      desc: t("states.empty.description"),
      illu: "empty-purchases",
      title: t("states.empty.title"),
    };
    return <EmptyState state={emptyState} />;
  }

  if (content.kind === "filtered-empty") {
    const filteredState: EmptyStateEntry = {
      desc: t("states.filteredEmpty.description"),
      illu: "empty-search",
      primary: { icon: "x", label: t("states.filteredEmpty.reset") },
      title: t("states.filteredEmpty.title"),
    };
    return <EmptyState onPrimary={onResetFilters} state={filteredState} />;
  }

  if (content.kind === "no-price") {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/60 p-8 text-center">
        <p className="mx-auto max-w-md text-sm text-muted-foreground">{t("states.noPrice")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <DeliveryMonthlyChart view={content.view} />
      <DeliveryStatusBreakdown view={content.view} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <DeliveryStoreBreakdown view={content.view} />
        <DeliveryTopOrders view={content.view} />
      </div>
    </div>
  );
}

function StatisticsSkeleton() {
  return (
    <div aria-busy className="flex flex-col gap-6">
      <Skeleton className="h-64 w-full rounded-xl" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton className="h-28 w-full rounded-xl" key={index} />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    </div>
  );
}
