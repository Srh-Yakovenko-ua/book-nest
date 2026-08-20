"use client";

import type { ReactNode } from "react";

import { useTranslations } from "next-intl";

import type { EmptyStateEntry } from "@/lib/empty-states";

import { EmptyState } from "@/components/empty-state";
import { pageTabsTriggerId } from "@/components/page-tabs";
import { TitleLeaf } from "@/components/title-leaf";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import type { HistoryOrderCardModel } from "../model/history-order-card-model";
import type { DeliveryHistoryTab } from "../model/history-params";

import { DELIVERY_HISTORY_PANEL_ID } from "../model/history-params";

export type HistoryContent =
  | { items: HistoryOrderCardModel[]; kind: "ready" }
  | { kind: "empty" }
  | { kind: "error" }
  | { kind: "filtered-empty" }
  | { kind: "loading" };

type DeliveryHistoryViewProps = {
  content: HistoryContent;
  onGoToInTransit: () => void;
  onLoadMore: () => void;
  onResetFilters: () => void;
  onRetry: () => void;
  pagination: { hasNextPage: boolean; isFetchingNextPage: boolean };
  renderCard: (model: HistoryOrderCardModel) => ReactNode;
  showToolbar: boolean;
  summary: ReactNode;
  tab: DeliveryHistoryTab;
  toolbar: ReactNode;
};

const SKELETON_COUNT = 4;

export function DeliveryHistoryView({
  content,
  onGoToInTransit,
  onLoadMore,
  onResetFilters,
  onRetry,
  pagination,
  renderCard,
  showToolbar,
  summary,
  tab,
  toolbar,
}: DeliveryHistoryViewProps) {
  const t = useTranslations("delivery.history");

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

        {summary}
      </header>

      {showToolbar ? toolbar : null}

      <div
        className="flex min-w-0 flex-col gap-6"
        {...(showToolbar
          ? {
              "aria-labelledby": pageTabsTriggerId(DELIVERY_HISTORY_PANEL_ID, tab),
              id: DELIVERY_HISTORY_PANEL_ID,
              role: "tabpanel",
            }
          : {})}
      >
        <h2 className="sr-only">{t("resultsTitle")}</h2>
        <HistoryContentArea
          content={content}
          onGoToInTransit={onGoToInTransit}
          onLoadMore={onLoadMore}
          onResetFilters={onResetFilters}
          onRetry={onRetry}
          pagination={pagination}
          renderCard={renderCard}
          tab={tab}
        />
      </div>
    </div>
  );
}

function HistoryContentArea({
  content,
  onGoToInTransit,
  onLoadMore,
  onResetFilters,
  onRetry,
  pagination,
  renderCard,
  tab,
}: Pick<
  DeliveryHistoryViewProps,
  | "content"
  | "onGoToInTransit"
  | "onLoadMore"
  | "onResetFilters"
  | "onRetry"
  | "pagination"
  | "renderCard"
  | "tab"
>) {
  const t = useTranslations("delivery.history");

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
    return <HistorySkeletonList />;
  }

  if (content.kind === "empty") {
    if (tab === "cancelled") {
      const cancelledState: EmptyStateEntry = {
        desc: t("states.empty.cancelled.description"),
        illu: "empty-delivery",
        title: t("states.empty.cancelled.title"),
      };
      return <EmptyState state={cancelledState} />;
    }

    const receivedState: EmptyStateEntry = {
      desc: t("states.empty.received.description"),
      illu: "empty-purchases",
      primary: { icon: "truck", label: t("states.empty.received.cta") },
      title: t("states.empty.received.title"),
    };
    return <EmptyState onPrimary={onGoToInTransit} state={receivedState} />;
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4">{content.items.map((model) => renderCard(model))}</div>

      {pagination.hasNextPage ? (
        <div className="flex justify-center pt-2">
          <Button
            disabled={pagination.isFetchingNextPage}
            loading={pagination.isFetchingNextPage}
            onClick={onLoadMore}
            variant="secondary"
          >
            {t("loadMore")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function HistorySkeletonList() {
  return (
    <div aria-busy className="flex flex-col gap-4">
      {Array.from({ length: SKELETON_COUNT }, (_, index) => (
        <div
          className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 shadow-card"
          key={index}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <Skeleton className="size-9 shrink-0 rounded-md" />
              <div className="flex flex-col gap-2 pt-0.5">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-28" />
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
          <Skeleton className="h-40 w-full rounded-md" />
        </div>
      ))}
    </div>
  );
}
