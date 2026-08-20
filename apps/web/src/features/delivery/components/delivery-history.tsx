"use client";

import type { Nullable } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";

import { useRouter } from "@/i18n/navigation";

import type { DeliveryRevealTarget } from "../hooks/use-reveal-delivery-target";
import type { HistoryOrderCardModel } from "../model/history-order-card-model";
import type { HistoryContent } from "./delivery-history-view";

import { useHistoryList } from "../api/use-history-list";
import { useHistoryOutcome } from "../api/use-history-outcome";
import { useHistorySummary } from "../api/use-history-summary";
import { useRevealDeliveryTarget } from "../hooks/use-reveal-delivery-target";
import { toHistoryOrderCards } from "../model/history-order-card-model";
import { DELIVERY_HISTORY_TAB_DEFAULT } from "../model/history-params";
import { buildHistorySummaryCards } from "../model/history-summary-cards";
import { buildDeliveryLatestReceiptCard } from "../model/latest-receipt-card";
import { useHistoryParams } from "../model/use-history-params";
import { DeliveryHistoryCard } from "./delivery-history-card";
import { DeliveryHistorySidebar } from "./delivery-history-sidebar";
import { DeliveryHistoryToolbar } from "./delivery-history-toolbar";
import { DeliveryHistoryView } from "./delivery-history-view";
import { DeliveryOverviewPanel } from "./delivery-overview-panel";
import { DeliverySummaryCards } from "./delivery-summary-cards";

export function DeliveryHistory() {
  const t = useTranslations("delivery.history");
  const tLatestReceipt = useTranslations("delivery.history.latestReceipt");
  const tSummary = useTranslations("delivery.history.summary");
  const tHistoryCard = useTranslations("delivery.history.card");
  const tLibraryCard = useTranslations("books.library.card");
  const tBadge = useTranslations("delivery.badge");
  const locale = useLocale();
  const router = useRouter();

  const params = useHistoryParams();
  const listQuery = useHistoryList(params.listParams);
  const summaryQuery = useHistorySummary();
  const outcomeQuery = useHistoryOutcome();

  const pages = listQuery.data?.pages ?? [];
  const totalCount = pages[0]?.totalCount ?? 0;
  const totalBooksCount = pages[0]?.totalBooksCount ?? 0;
  const items: HistoryOrderCardModel[] = toHistoryOrderCards(
    pages.flatMap((page) => page.items),
    {
      labels: {
        cancelledOn: (date) => tHistoryCard("cancelledOn", { date }),
        expectedOn: (date) => tHistoryCard("expectedOn", { date }),
        receivedOn: (date) => tHistoryCard("receivedOn", { date }),
        seriesPosition: (position, total) => tLibraryCard("seriesPosition", { position, total }),
        status: (key) => tBadge(key),
      },
      locale,
      search: params.state.q,
      tab: params.tab,
    },
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

  const loadedShipmentIds = items.flatMap((item) =>
    item.shipments.flatMap((group) => (group.id === null ? [] : [group.id])),
  );
  const reveal = useRevealDeliveryTarget({
    fetchNextPage: () => void listQuery.fetchNextPage(),
    hasNextPage: listQuery.hasNextPage,
    isFetchingNextPage: listQuery.isFetchingNextPage,
    isShowingPreviousList: listQuery.isPlaceholderData,
    loadedOrderIds: items.map((item) => item.id),
    loadedShipmentIds,
  });
  const revealedTarget = reveal.revealed;

  const latestReceiptCard = buildDeliveryLatestReceiptCard({
    labels: {
      booksCount: (count) => tLatestReceipt("booksCount", { count }),
      daysAgo: (count) => tLatestReceipt("daysAgo", { count }),
      sameDay: (count) => tLatestReceipt("sameDay", { count }),
      today: tLatestReceipt("today"),
      yesterday: tLatestReceipt("yesterday"),
    },
    locale,
    now: new Date(),
    summary: summaryQuery.data ?? null,
  });

  const receiptTarget: Nullable<DeliveryRevealTarget> =
    latestReceiptCard === null
      ? null
      : latestReceiptCard.shipmentId === null
        ? { id: latestReceiptCard.orderId, kind: "order" }
        : { id: latestReceiptCard.shipmentId, kind: "shipment" };

  const receiptNeedsReset =
    receiptTarget !== null &&
    (params.hasActiveSearch || params.hasActiveFilters) &&
    !(receiptTarget.kind === "order" ? items.map((item) => item.id) : loadedShipmentIds).includes(
      receiptTarget.id,
    );

  function revealLatestReceipt() {
    if (receiptTarget === null) return;
    if (receiptNeedsReset) params.clearAll();
    reveal.request(receiptTarget);
  }

  const renderCard = (model: HistoryOrderCardModel) => (
    <DeliveryHistoryCard
      key={model.id}
      model={model}
      revealedOrderId={revealedTarget?.kind === "order" ? revealedTarget.id : null}
      revealedShipmentId={revealedTarget?.kind === "shipment" ? revealedTarget.id : null}
      search={params.state.q}
    />
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
      sidebar={
        params.tab === DELIVERY_HISTORY_TAB_DEFAULT ? (
          <DeliveryHistorySidebar
            isOutcomeLoading={outcomeQuery.isPending}
            isReceiptLoading={summaryQuery.isPending}
            latestReceipt={latestReceiptCard}
            onRevealLatestReceipt={revealLatestReceipt}
            outcome={outcomeQuery.data ?? null}
            revealResetsFilters={receiptNeedsReset}
          />
        ) : undefined
      }
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
          canSortByPrice={params.canSortByPrice}
          counterLabel={t("counter", {
            books: totalBooksCount,
            shown: items.length,
            total: totalCount,
          })}
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
