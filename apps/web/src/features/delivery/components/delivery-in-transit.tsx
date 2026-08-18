"use client";

import type { ActiveShipmentStatus, Nullable } from "@app/shared";

import { useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { useDeliveryErrorText } from "@/features/books/hooks/use-delivery-error-text";
import { useRouter } from "@/i18n/navigation";

import type { DeliverySummaryLabels } from "../model/in-transit-summary-cards";
import type { DeliveryOrderBookModel, DeliveryOrderCardModel } from "../model/order-card-model";
import type { DeliveryContent } from "./delivery-in-transit-view";

import { bookOrderQueryOptions } from "../api/use-book-order";
import { useInTransitList } from "../api/use-in-transit-list";
import { useInTransitSummary } from "../api/use-in-transit-summary";
import { useSetShipmentStatus } from "../api/use-order-shipment-actions";
import { toDeliveryFilterCounts } from "../model/in-transit-params";
import { buildDeliverySummaryCards } from "../model/in-transit-summary-cards";
import { toDeliveryOrderCards } from "../model/order-card-model";
import { useInTransitParams } from "../model/use-in-transit-params";
import { CreateBookOrderDialog } from "./create-book-order-dialog";
import { DeliveryBulkBar } from "./delivery-bulk-bar";
import { DeliveryCancelDialog } from "./delivery-cancel-dialog";
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
  const locale = useLocale();
  const router = useRouter();
  const deliveryErrorText = useDeliveryErrorText();

  const params = useInTransitParams();
  const listQuery = useInTransitList(params.listParams);
  const summaryQuery = useInTransitSummary();
  const setShipmentStatus = useSetShipmentStatus();

  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [editBook, setEditBook] = useState<Nullable<DeliveryOrderBookModel>>(null);
  const [cancelBookId, setCancelBookId] = useState<Nullable<string>>(null);
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

  const visibleBookIds = orders.flatMap((order) =>
    order.shipments.flatMap((group) => group.books.map((book) => book.bookId)),
  );
  const selectedVisible = visibleBookIds.filter((id) => selectedIds.has(id));
  const allVisibleSelected =
    visibleBookIds.length > 0 && selectedVisible.length === visibleBookIds.length;
  const selectAllChecked: "indeterminate" | boolean =
    selectedVisible.length === 0 ? false : allVisibleSelected ? true : "indeterminate";

  function toggleSelect(bookId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(bookId)) next.delete(bookId);
      else next.add(bookId);
      return next;
    });
  }

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
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) visibleBookIds.forEach((id) => next.delete(id));
      else visibleBookIds.forEach((id) => next.add(id));
      return next;
    });
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

  const filterCounts =
    summaryData === undefined || params.hasActiveSearch
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

  const renderCard = (model: DeliveryOrderCardModel) => (
    <DeliveryOrderCard
      key={model.id}
      model={model}
      onCancelBook={setCancelBookId}
      onChangeShipmentStatus={changeShipmentStatus}
      onEditBook={setEditBook}
      onManage={(action) => void openManageAction(action)}
      onReceiveShipment={(shipmentId, bookCount) =>
        setReceiveTarget({ bookCount, kind: "shipment", shipmentId })
      }
      onToggleSelectBook={toggleSelect}
      preparingEdit={preparingOrderId === model.id}
      selectedBookIds={selectedIds}
      selectionMode={selectionMode}
    />
  );

  return (
    <>
      <DeliveryInTransitView
        bulkBar={
          selectedVisible.length > 0 ? (
            <DeliveryBulkBar
              count={selectedVisible.length}
              onClear={() => setSelectedIds(new Set())}
              onReceive={() => setReceiveTarget({ bookIds: selectedVisible, kind: "books" })}
            />
          ) : null
        }
        content={content}
        headerActions={
          <>
            <Button onClick={() => setCreateOrderOpen(true)}>
              <UiIcon name="plus" size={16} />
              {t("actions.addOrder")}
            </Button>
            {visibleBookIds.length > 0 ? (
              <Button
                onClick={() => {
                  setSelectionMode((value) => !value);
                  setSelectedIds(new Set());
                }}
                variant="secondary"
              >
                <UiIcon name="check" size={16} />
                {selectionMode ? t("actions.doneSelecting") : t("actions.select")}
              </Button>
            ) : null}
            {visibleBookIds.length > 0 ? (
              <Button
                onClick={() => setReceiveTarget({ bookIds: visibleBookIds, kind: "books" })}
                variant="secondary"
              >
                <UiIcon name="check-circle" size={16} />
                {t("actions.receiveAll")}
              </Button>
            ) : null}
          </>
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
          selectionMode && visibleBookIds.length > 0
            ? {
                checked: selectAllChecked,
                count: selectedVisible.length,
                onToggle: toggleSelectAll,
              }
            : undefined
        }
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
        toolbar={
          <DeliveryToolbar
            counterLabel={t("counter", {
              orders: orders.length,
              shown: loadedItems.length,
              total: totalCount,
            })}
            filter={params.filter}
            filterCounts={filterCounts}
            isPending={listQuery.isPending}
            loadingLabel={t("states.loading")}
            onClearSearch={params.clearSearch}
            onFilterChange={params.setFilter}
            onSearch={params.setSearch}
            onSortChange={params.setSort}
            searchValue={params.state.q}
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

      {cancelBookId === null ? null : (
        <DeliveryCancelDialog
          bookId={cancelBookId}
          onOpenChange={(open) => {
            if (!open) setCancelBookId(null);
          }}
          open
        />
      )}

      {receiveTarget === null ? null : (
        <DeliveryReceiveDialog
          onOpenChange={(open) => {
            if (!open) setReceiveTarget(null);
          }}
          onReceived={() => setSelectedIds(new Set())}
          open
          target={receiveTarget}
        />
      )}
    </>
  );
}
