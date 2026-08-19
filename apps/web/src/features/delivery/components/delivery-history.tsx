"use client";

import { useLocale, useTranslations } from "next-intl";

import { useRouter } from "@/i18n/navigation";

import type { DeliveryHistoryCardModel } from "../model/history-card-model";
import type { HistoryContent } from "./delivery-history-view";

import { useHistoryList } from "../api/use-history-list";
import { useHistorySummary } from "../api/use-history-summary";
import { toHistoryCardModel } from "../model/history-card-model";
import { buildHistorySummaryCards } from "../model/history-summary-cards";
import { useHistoryParams } from "../model/use-history-params";
import { DeliveryHistoryCard } from "./delivery-history-card";
import { DeliveryHistoryToolbar } from "./delivery-history-toolbar";
import { DeliveryHistoryView } from "./delivery-history-view";
import { DeliveryOverviewPanel } from "./delivery-overview-panel";
import { DeliverySummaryCards } from "./delivery-summary-cards";

export function DeliveryHistory() {
  const t = useTranslations("delivery.history");
  const tSummary = useTranslations("delivery.history.summary");
  const tCard = useTranslations("delivery.card");
  const tBadge = useTranslations("delivery.badge");
  const locale = useLocale();
  const router = useRouter();

  const params = useHistoryParams();
  const listQuery = useHistoryList(params.listParams);
  const summaryQuery = useHistorySummary();

  const pages = listQuery.data?.pages ?? [];
  const totalCount = pages[0]?.totalCount ?? 0;
  const items: DeliveryHistoryCardModel[] = pages
    .flatMap((page) => page.items)
    .map((item) =>
      toHistoryCardModel(item, {
        labels: {
          badge: (key) => tBadge(key),
          seriesPart: ({ name, part }) => tCard("seriesPart", { name, part }),
        },
        locale,
      }),
    );

  const content: HistoryContent = listQuery.isError
    ? { kind: "error" }
    : listQuery.isPending
      ? { kind: "loading" }
      : items.length === 0
        ? params.hasActiveFilters || params.hasActiveSearch
          ? { kind: "filtered-empty" }
          : { kind: "empty" }
        : { items, kind: "ready" };

  const showToolbar =
    !listQuery.isError &&
    (listQuery.isPending || items.length > 0 || params.hasActiveSearch || params.hasActiveFilters);

  const summaryCards = buildHistorySummaryCards({
    labels: {
      cancelled: {
        empty: tSummary("cancelled.empty"),
        label: tSummary("cancelled.label"),
        orders: (count) => tSummary("cancelled.orders", { count }),
      },
      completed: {
        empty: tSummary("completed.empty"),
        label: tSummary("completed.label"),
        withCancellations: (count) => tSummary("completed.withCancellations", { count }),
        withoutCancellations: (count) => tSummary("completed.withoutCancellations", { count }),
      },
      mobile: (key) => ({
        compact: tSummary(`mobile.compact.${key}`),
        detailed: tSummary(`mobile.detailed.${key}`),
      }),
      received: {
        empty: tSummary("received.empty"),
        label: tSummary("received.label"),
        orders: (count) => tSummary("received.orders", { count }),
        shipments: (count) => tSummary("received.shipments", { count }),
      },
      seriesToppedUp: {
        allStandalone: (count) => tSummary("seriesToppedUp.allStandalone", { count }),
        empty: tSummary("seriesToppedUp.empty"),
        label: tSummary("seriesToppedUp.label"),
        seriesBooks: (count) => tSummary("seriesToppedUp.seriesBooks", { count }),
        standalone: (count) => tSummary("seriesToppedUp.standalone", { count }),
      },
      units: {
        books: (count) => tSummary("units.books", { count }),
        orders: (count) => tSummary("units.orders", { count }),
        series: (count) => tSummary("units.series", { count }),
      },
    },
    locale,
    summary: summaryQuery.data ?? null,
  });

  const renderCard = (model: DeliveryHistoryCardModel) => (
    <DeliveryHistoryCard key={model.id} model={model} />
  );

  return (
    <DeliveryHistoryView
      content={content}
      onGoToInTransit={() => router.push("/delivery/in-transit")}
      onLoadMore={() => void listQuery.fetchNextPage()}
      onResetFilters={params.clearAll}
      onRetry={() => void listQuery.refetch()}
      pagination={{
        hasNextPage: listQuery.hasNextPage,
        isFetchingNextPage: listQuery.isFetchingNextPage,
      }}
      renderCard={renderCard}
      showToolbar={showToolbar}
      summary={
        <DeliverySummaryCards
          cards={summaryCards}
          isLoading={summaryQuery.isPending}
          mobileAction={
            <DeliveryOverviewPanel
              detailsTitle={tSummary("mobile.title")}
              isLoading={summaryQuery.isPending}
              summaryCards={summaryCards}
            />
          }
        />
      }
      tab={params.tab}
      toolbar={
        <DeliveryHistoryToolbar
          counterLabel={t("counter", { shown: items.length, total: totalCount })}
          filterCount={params.filterCount}
          isPending={listQuery.isPending}
          loadingLabel={t("states.loading")}
          onApplyFilters={params.setFilters}
          onClearSearch={params.clearSearch}
          onResetFilters={params.clearFilters}
          onSearch={params.setSearch}
          onSortChange={params.setSort}
          onTabChange={params.setTab}
          sort={params.sort}
          state={params.state}
          tab={params.tab}
        />
      }
    />
  );
}
