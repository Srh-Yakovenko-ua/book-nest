"use client";

import type { ReactNode } from "react";

import { useTranslations } from "next-intl";

import type { EmptyStateEntry } from "@/lib/empty-states";

import { EmptyState } from "@/components/empty-state";
import { TitleLeaf } from "@/components/title-leaf";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";

import type { DeliveryOrderCardModel } from "../model/order-card-model";

export type DeliveryContent =
  | { items: DeliveryOrderCardModel[]; kind: "ready" }
  | { kind: "empty" }
  | { kind: "error" }
  | { kind: "filtered-empty" }
  | { kind: "loading" };

type DeliveryInTransitViewProps = {
  bulkBar?: ReactNode;
  content: DeliveryContent;
  headerActions?: ReactNode;
  onGoToBooksToBuy: () => void;
  onLoadMore: () => void;
  onResetFilters: () => void;
  onRetry: () => void;
  pagination: { hasNextPage: boolean; isFetchingNextPage: boolean };
  renderCard: (model: DeliveryOrderCardModel) => ReactNode;
  selectAll?: { checked: "indeterminate" | boolean; count: number; onToggle: () => void };
  showToolbar: boolean;
  summary: ReactNode;
  toolbar: ReactNode;
};

const SKELETON_COUNT = 3;

export function DeliveryInTransitView({
  bulkBar,
  content,
  headerActions,
  onGoToBooksToBuy,
  onLoadMore,
  onResetFilters,
  onRetry,
  pagination,
  renderCard,
  selectAll,
  showToolbar,
  summary,
  toolbar,
}: DeliveryInTransitViewProps) {
  const t = useTranslations("delivery");

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-6 motion-safe:animate-in motion-safe:duration-500 motion-safe:fill-mode-both motion-safe:fade-in motion-safe:slide-in-from-bottom-1">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <h1 className="font-heading text-[clamp(1.75rem,3.5vw,2.5rem)] leading-tight font-semibold text-ink">
                {t("title")}
              </h1>
              <TitleLeaf />
            </div>
            <p className="max-w-2xl text-sm text-muted-foreground">{t("subtitle")}</p>
          </div>
          {headerActions ? <div className="flex shrink-0 gap-2">{headerActions}</div> : null}
        </div>

        {summary}
      </header>

      {showToolbar ? toolbar : null}

      <div className="flex min-w-0 flex-col gap-6">
        <h2 className="sr-only">{t("resultsTitle")}</h2>
        <DeliveryContentArea
          content={content}
          onGoToBooksToBuy={onGoToBooksToBuy}
          onLoadMore={onLoadMore}
          onResetFilters={onResetFilters}
          onRetry={onRetry}
          pagination={pagination}
          renderCard={renderCard}
          selectAll={selectAll}
        />
      </div>

      {bulkBar}
    </div>
  );
}

function DeliveryContentArea({
  content,
  onGoToBooksToBuy,
  onLoadMore,
  onResetFilters,
  onRetry,
  pagination,
  renderCard,
  selectAll,
}: Pick<
  DeliveryInTransitViewProps,
  | "content"
  | "onGoToBooksToBuy"
  | "onLoadMore"
  | "onResetFilters"
  | "onRetry"
  | "pagination"
  | "renderCard"
  | "selectAll"
>) {
  const t = useTranslations("delivery");

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
    return <DeliverySkeletonList />;
  }

  if (content.kind === "empty") {
    const emptyState: EmptyStateEntry = {
      desc: t("states.empty.description"),
      illu: "empty-delivery",
      primary: { icon: "cart", label: t("states.empty.cta") },
      title: t("states.empty.title"),
    };
    return <EmptyState onPrimary={onGoToBooksToBuy} state={emptyState} />;
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
      {selectAll ? (
        <label className="flex w-fit cursor-pointer items-center gap-2.5 text-sm text-muted-foreground">
          <Checkbox checked={selectAll.checked} onCheckedChange={selectAll.onToggle} />
          {t("bulk.selectAllVisible", { count: selectAll.count })}
        </label>
      ) : null}

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
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

function DeliverySkeletonList() {
  return (
    <div aria-busy className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
      {Array.from({ length: SKELETON_COUNT }, (_, index) => (
        <div
          className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 shadow-card"
          key={index}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-2.5">
              <Skeleton className="size-8 shrink-0 rounded-md" />
              <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-40" />
              </div>
            </div>
            <Skeleton className="h-3 w-24" />
          </div>
          <div className="flex flex-col gap-3 rounded-md border border-border bg-secondary/40 p-3.5">
            <Skeleton className="h-5 w-24 rounded-full" />
            <Skeleton className="h-14 w-full rounded-md" />
            <Skeleton className="h-14 w-full rounded-md" />
            <Skeleton className="h-9 w-full rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}
