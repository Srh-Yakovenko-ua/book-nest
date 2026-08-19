"use client";

import type { ActiveShipmentStatus, InTransitAttentionReason, Nullable } from "@app/shared";

import { IN_TRANSIT_ATTENTION_FILTER } from "@app/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { CancelDeliveryDialog } from "@/features/books/components/cancel-delivery-dialog";
import { useDeliveryErrorText } from "@/features/books/hooks/use-delivery-error-text";
import { useRouter } from "@/i18n/navigation";

import type { DeliverySummaryLabels } from "../model/in-transit-summary-cards";
import type { DeliveryOrderBookModel, DeliveryOrderCardModel } from "../model/order-card-model";
import type { DeliveryContent } from "./delivery-in-transit-view";

import { bookOrderQueryOptions } from "../api/use-book-order";
import { useInTransitImpact } from "../api/use-in-transit-impact";
import { useInTransitList } from "../api/use-in-transit-list";
import { useInTransitSummary } from "../api/use-in-transit-summary";
import { useSetShipmentStatus } from "../api/use-order-shipment-actions";
import { useRevealDeliveryTarget } from "../hooks/use-reveal-delivery-target";
import { useDeliverySelectionStore } from "../model/delivery-selection-store";
import { toDeliveryAttentionReason, toDeliveryFilterCounts } from "../model/in-transit-params";
import { buildDeliverySummaryCards } from "../model/in-transit-summary-cards";
import { buildDeliveryNextShipmentCard } from "../model/next-shipment-card";
import { toDeliveryOrderCards, toSelectableShipments } from "../model/order-card-model";
import { useInTransitParams } from "../model/use-in-transit-params";
import { CreateBookOrderDialog } from "./create-book-order-dialog";
import { DeliveryBulkBar } from "./delivery-bulk-bar";
import { DeliveryInTransitSidebar } from "./delivery-in-transit-sidebar";
import { DeliveryInTransitView } from "./delivery-in-transit-view";
import { DeliveryOrderCard } from "./delivery-order-card";
import { DeliveryOverviewPanel } from "./delivery-overview-panel";
import { DeliveryReceiveDialog, type DeliveryReceiveTarget } from "./delivery-receive-dialog";
import { DeliverySummaryCards } from "./delivery-summary-cards";
import { DeliveryToolbar } from "./delivery-toolbar";
import { OrderItemPriceDialog } from "./order-item-price-dialog";
import {
  type OrderShipmentAction,
  OrderShipmentActionDialog,
} from "./order-shipment-action-dialog";

export function DeliveryInTransit() {
  const t = useTranslations("delivery");
  const tSummary = useTranslations("delivery.summary");
  const tBadge = useTranslations("delivery.badge");
  const tToast = useTranslations("delivery.toast");
  const tLibraryCard = useTranslations("books.library.card");
  const tNextShipment = useTranslations("delivery.nextShipment");
  const locale = useLocale();
  const router = useRouter();
  const deliveryErrorText = useDeliveryErrorText();

  const params = useInTransitParams();
  const listQuery = useInTransitList(params.listParams);
  const summaryQuery = useInTransitSummary();
  const impactQuery = useInTransitImpact();
  const setShipmentStatus = useSetShipmentStatus();

  const clearSelection = useDeliverySelectionStore((state) => state.clear);
  const enterSelection = useDeliverySelectionStore((state) => state.enterSelection);
  const exitSelection = useDeliverySelectionStore((state) => state.exitSelection);
  const selectAllShipments = useDeliverySelectionStore((state) => state.selectAll);
  const selectedIds = useDeliverySelectionStore((state) => state.selectedIds);
  const selectionMode = useDeliverySelectionStore((state) => state.selectionMode);
  const toggleSelectShipment = useDeliverySelectionStore((state) => state.toggle);

  const [editBook, setEditBook] = useState<Nullable<DeliveryOrderBookModel>>(null);
  const [cancelBook, setCancelBook] = useState<Nullable<DeliveryOrderBookModel>>(null);
  const [receiveTarget, setReceiveTarget] = useState<Nullable<DeliveryReceiveTarget>>(null);
  const [createOrderOpen, setCreateOrderOpen] = useState(false);
  const [manageAction, setManageAction] = useState<Nullable<OrderShipmentAction>>(null);
  const [preparingOrderId, setPreparingOrderId] = useState<Nullable<string>>(null);
  const queryClient = useQueryClient();

  async function openManageAction(action: OrderShipmentAction) {
    if (action.kind !== "edit-order") {
      setManageAction(action);
      return;
    }

    setPreparingOrderId(action.order.id);
    try {
      await queryClient.ensureQueryData(bookOrderQueryOptions(action.order.id));
    } finally {
      setPreparingOrderId(null);
      setManageAction(action);
    }
  }

  const pages = listQuery.data?.pages ?? [];
  const totalCount = pages[0]?.totalCount ?? 0;
  const loadedItems = pages.flatMap((page) => page.items);
  const orders = toDeliveryOrderCards(loadedItems, {
    labels: {
      badge: (key) => tBadge(key),
      orderStatus: (key) => t(`orderStatus.${key}`),
      seriesPosition: (position, total) => tLibraryCard("seriesPosition", { position, total }),
    },
    locale,
  });

  const loadedShipmentIds = loadedItems.flatMap((item) =>
    item.shipment === null ? [] : [item.shipment.id],
  );
  const reveal = useRevealDeliveryTarget({
    fetchNextPage: () => void listQuery.fetchNextPage(),
    hasNextPage: listQuery.hasNextPage,
    isFetchingNextPage: listQuery.isFetchingNextPage,
    isShowingPreviousList: listQuery.isPlaceholderData,
    loadedOrderIds: orders.map((order) => order.id),
    loadedShipmentIds,
  });
  const revealedTarget = reveal.revealed;

  const selectableShipments = toSelectableShipments(orders);
  const selectableShipmentIdsKey = selectableShipments.map((shipment) => shipment.id).join("\n");

  useEffect(() => {
    const ids = selectableShipmentIdsKey === "" ? [] : selectableShipmentIdsKey.split("\n");
    useDeliverySelectionStore.getState().setAvailable(ids);
  }, [selectableShipmentIdsKey]);

  useEffect(() => () => useDeliverySelectionStore.getState().exitSelection(), []);

  const selectedShipments = selectableShipments.filter((shipment) => selectedIds.has(shipment.id));
  const allVisibleSelected =
    selectableShipments.length > 0 && selectedShipments.length === selectableShipments.length;
  const selectAllChecked: "indeterminate" | boolean =
    selectedShipments.length === 0 ? false : allVisibleSelected ? true : "indeterminate";
  const selectedBooksCount = selectedShipments.reduce(
    (total, shipment) => total + shipment.activeItemsCount,
    0,
  );

  function changeShipmentStatus(shipmentId: string, status: ActiveShipmentStatus) {
    setShipmentStatus.mutate(
      { shipmentId, status },
      {
        onError: (error) => toast.error(deliveryErrorText(error)),
        onSuccess: () => toast.success(tToast("statusUpdated")),
      },
    );
  }

  function toggleSelectAll() {
    if (allVisibleSelected) clearSelection();
    else selectAllShipments(selectableShipments.map((shipment) => shipment.id));
  }

  const content: DeliveryContent = listQuery.isError
    ? { kind: "error" }
    : listQuery.isPending
      ? { kind: "loading" }
      : orders.length === 0
        ? params.hasActiveFilters || params.hasActiveSearch
          ? { kind: "filtered-empty" }
          : { kind: "empty" }
        : { items: orders, kind: "ready" };

  const showToolbar =
    !listQuery.isError &&
    (listQuery.isPending || orders.length > 0 || params.hasActiveSearch || params.hasActiveFilters);

  const summaryData = summaryQuery.data;
  const attention = summaryData?.attention ?? [];
  const activeAttentionReason = toDeliveryAttentionReason(params.filter);

  const filterCounts =
    summaryData === undefined || params.hasActiveSearch || params.advancedCount > 0
      ? undefined
      : toDeliveryFilterCounts(summaryData);

  const summaryLabels: DeliverySummaryLabels = {
    active: {
      empty: tSummary("microfact.active.empty"),
      inTransit: (count) => tSummary("microfact.active.inTransit", { count }),
      label: tSummary("active"),
      ordered: (count) => tSummary("microfact.active.ordered", { count }),
      readyForPickup: (count) => tSummary("microfact.active.readyForPickup", { count }),
    },
    activeOrders: {
      empty: tSummary("microfact.activeOrders.empty"),
      label: tSummary("activeOrders"),
      noShipments: tSummary("microfact.activeOrders.noShipments"),
      shipments: (count) => tSummary("microfact.activeOrders.shipments", { count }),
      split: (count) => tSummary("microfact.activeOrders.split", { count }),
    },
    expectedThisWeek: {
      empty: tSummary("microfact.expectedThisWeek.empty"),
      label: tSummary("expectedThisWeek"),
      onDate: (date) => tSummary("microfact.expectedThisWeek.onDate", { date }),
      today: tSummary("microfact.expectedThisWeek.today"),
      tomorrow: tSummary("microfact.expectedThisWeek.tomorrow"),
    },
    mobile: (key) => ({
      compact: tSummary(`mobile.compact.${key}`),
      detailed: tSummary(`mobile.detailed.${key}`),
    }),
    ordersTotal: {
      coverageAll: (count) => tSummary("microfact.ordersTotal.coverageAll", { count }),
      coverageNone: (count) => tSummary("microfact.ordersTotal.coverageNone", { count }),
      coveragePartial: (known, total) =>
        tSummary("microfact.ordersTotal.coveragePartial", { known, total }),
      empty: tSummary("microfact.ordersTotal.empty"),
      label: tSummary("ordersTotal"),
    },
    units: {
      books: (count) => tSummary("units.books", { count }),
      orders: (count) => tSummary("units.orders", { count }),
    },
  };

  const summaryCards = buildDeliverySummaryCards({
    labels: summaryLabels,
    locale,
    summary: summaryData ?? null,
  });

  const nextShipmentCard = buildDeliveryNextShipmentCard({
    labels: {
      booksCount: (count) => tNextShipment("booksCount", { count }),
      inDays: (count) => tNextShipment("inDays", { count }),
      sameDay: (count) => tNextShipment("sameDay", { count }),
      today: tNextShipment("today"),
      tomorrow: tNextShipment("tomorrow"),
    },
    locale,
    now: new Date(),
    summary: summaryData ?? null,
  });

  const nextShipmentNeedsReset =
    nextShipmentCard !== null &&
    (params.hasActiveSearch || params.hasActiveFilters) &&
    !loadedShipmentIds.includes(nextShipmentCard.shipmentId);

  function revealNextShipment() {
    if (nextShipmentCard === null) return;
    if (nextShipmentNeedsReset) params.clearAll();
    reveal.request({ id: nextShipmentCard.shipmentId, kind: "shipment" });
  }

  function selectAttention(reason: InTransitAttentionReason) {
    params.setFilterAndClearSearch(IN_TRANSIT_ATTENTION_FILTER[reason]);

    const entry = attention.find((item) => item.reason === reason);
    if (entry?.reason !== "unassigned_books" || entry.revealOrderId === null) return;

    reveal.request({ id: entry.revealOrderId, kind: "order" });
  }

  const renderCard = (model: DeliveryOrderCardModel) => (
    <DeliveryOrderCard
      key={model.id}
      model={model}
      onCancelBook={setCancelBook}
      onChangeShipmentStatus={changeShipmentStatus}
      onEditBook={setEditBook}
      onManage={(action) => void openManageAction(action)}
      onReceiveShipment={(shipmentId, bookCount) =>
        setReceiveTarget({ bookCount, kind: "shipment", shipmentId })
      }
      onToggleSelectShipment={toggleSelectShipment}
      preparingEdit={preparingOrderId === model.id}
      revealedOrderId={revealedTarget?.kind === "order" ? revealedTarget.id : null}
      revealedShipmentId={revealedTarget?.kind === "shipment" ? revealedTarget.id : null}
      selectedShipmentIds={selectedIds}
      selectionMode={selectionMode}
    />
  );

  return (
    <>
      <DeliveryInTransitView
        bulkBar={
          selectedShipments.length > 0 ? (
            <DeliveryBulkBar
              bookCount={selectedBooksCount}
              onClear={clearSelection}
              onReceive={() =>
                setReceiveTarget({
                  bookCount: selectedBooksCount,
                  kind: "shipments",
                  shipmentIds: selectedShipments.map((shipment) => shipment.id),
                })
              }
              shipmentCount={selectedShipments.length}
            />
          ) : null
        }
        content={content}
        headerActions={
          <Button onClick={() => setCreateOrderOpen(true)}>
            <UiIcon name="plus" size={16} />
            {t("actions.addOrder")}
          </Button>
        }
        onGoToBooksToBuy={() => router.push("/books-to-buy")}
        onLoadMore={() => void listQuery.fetchNextPage()}
        onResetFilters={params.clearAll}
        onRetry={() => void listQuery.refetch()}
        pagination={{
          hasNextPage: listQuery.hasNextPage,
          isFetchingNextPage: listQuery.isFetchingNextPage,
        }}
        renderCard={renderCard}
        selectAll={
          selectionMode && selectableShipments.length > 0
            ? {
                checked: selectAllChecked,
                count: selectedShipments.length,
                onToggle: toggleSelectAll,
              }
            : undefined
        }
        showToolbar={showToolbar}
        sidebar={
          <DeliveryInTransitSidebar
            activeAttentionReason={activeAttentionReason}
            attention={attention}
            impact={impactQuery.data?.items ?? []}
            isLoading={summaryQuery.isPending}
            nextShipment={nextShipmentCard}
            onAttentionSelect={selectAttention}
            onRevealNextShipment={revealNextShipment}
            revealResetsFilters={nextShipmentNeedsReset}
          />
        }
        summary={
          <DeliverySummaryCards
            cards={summaryCards}
            isLoading={summaryQuery.isPending}
            mobileAction={
              <DeliveryOverviewPanel
                attention={{
                  activeReason: activeAttentionReason,
                  items: attention,
                  onSelect: selectAttention,
                }}
                detailsTitle={tSummary("mobile.title")}
                isLoading={summaryQuery.isPending}
                summaryCards={summaryCards}
              />
            }
          />
        }
        toolbar={
          <DeliveryToolbar
            advanced={params.state}
            advancedCount={params.advancedCount}
            counterLabel={t("counter", {
              orders: orders.length,
              shown: loadedItems.length,
              total: totalCount,
            })}
            filter={params.filter}
            filterCounts={filterCounts}
            isPending={listQuery.isPending}
            loadingLabel={t("states.loading")}
            onApplyAdvanced={params.applyAdvanced}
            onClearAll={params.clearFilters}
            onClearSearch={params.clearSearch}
            onFilterChange={params.setFilter}
            onSearch={params.setSearch}
            onSortChange={params.setSort}
            searchValue={params.state.q}
            selection={
              selectableShipments.length === 0
                ? undefined
                : {
                    isSelecting: selectionMode,
                    onToggle: () => (selectionMode ? exitSelection() : enterSelection()),
                  }
            }
            sort={params.sort}
          />
        }
      />

      {editBook === null ? null : (
        <OrderItemPriceDialog
          book={editBook}
          onOpenChange={(open) => {
            if (!open) setEditBook(null);
          }}
          open
        />
      )}

      <CreateBookOrderDialog onOpenChange={setCreateOrderOpen} open={createOrderOpen} />

      {manageAction === null ? null : (
        <OrderShipmentActionDialog
          action={manageAction}
          onOpenChange={(open) => {
            if (!open) setManageAction(null);
          }}
        />
      )}

      {cancelBook === null ? null : (
        <CancelDeliveryDialog
          bookId={cancelBook.bookId}
          bookTitle={cancelBook.title}
          deliveryId={cancelBook.id}
          onOpenChange={(open) => {
            if (!open) setCancelBook(null);
          }}
          open
        />
      )}

      {receiveTarget === null ? null : (
        <DeliveryReceiveDialog
          onOpenChange={(open) => {
            if (!open) setReceiveTarget(null);
          }}
          onReceived={clearSelection}
          open
          target={receiveTarget}
        />
      )}
    </>
  );
}
