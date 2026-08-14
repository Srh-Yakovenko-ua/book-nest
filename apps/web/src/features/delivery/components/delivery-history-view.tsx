"use client";

import type { ReactNode } from "react";

import { useTranslations } from "next-intl";

import type { EmptyStateEntry } from "@/lib/empty-states";
import type { DeliveryReadControllerHistoryListTab } from "@/shared/api/generated/model";

import { EmptyState } from "@/components/empty-state";
import { pageTabsTriggerId } from "@/components/page-tabs";
import { TitleLeaf } from "@/components/title-leaf";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import type { DeliveryHistoryCardModel } from "../model/history-card-model";

import { DELIVERY_HISTORY_PANEL_ID } from "../model/history-params";

export type HistoryContent =
  | { items: DeliveryHistoryCardModel[]; kind: "ready" }
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
  renderCard: (model: DeliveryHistoryCardModel) => ReactNode;
  showToolbar: boolean;
  summary: ReactNode;
  tab: DeliveryReadControllerHistoryListTab;
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
}: Pick<
  DeliveryHistoryViewProps,
  | "content"
  | "onGoToInTransit"
  | "onLoadMore"
  | "onResetFilters"
  | "onRetry"
  | "pagination"
  | "renderCard"
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
    const emptyState: EmptyStateEntry = {
      desc: t("states.empty.description"),
      illu: "empty-purchases",
      primary: { icon: "truck", label: t("states.empty.cta") },
      title: t("states.empty.title"),
    };
    return <EmptyState onPrimary={onGoToInTransit} state={emptyState} />;
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
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {content.items.map((model) => renderCard(model))}
      </div>

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
    <div aria-busy className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {Array.from({ length: SKELETON_COUNT }, (_, index) => (
        <div
          className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 shadow-card"
          key={index}
        >
          <div className="flex gap-3.5">
            <Skeleton className="h-24 w-16 shrink-0 rounded-md sm:w-20" />
            <div className="flex flex-1 flex-col gap-2 pt-1">
              <Skeleton className="h-5 w-24 rounded-full" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
          <Skeleton className="h-24 w-full rounded-md" />
        </div>
      ))}
    </div>
  );
}
