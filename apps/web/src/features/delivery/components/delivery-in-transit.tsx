"use client";

import type { ActiveShipmentStatus, Nullable } from "@app/shared";

import { useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import type { LibrarySummaryCard } from "@/features/books/components/library-summary-cards";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { useDeliveryErrorText } from "@/features/books/hooks/use-delivery-error-text";
import { useRouter } from "@/i18n/navigation";

import type { DeliveryOrderBookModel, DeliveryOrderCardModel } from "../model/order-card-model";
import type { DeliveryContent } from "./delivery-in-transit-view";

import { bookOrderQueryOptions } from "../api/use-book-order";
import { useInTransitList } from "../api/use-in-transit-list";
import { useInTransitSummary } from "../api/use-in-transit-summary";
import { useSetShipmentStatus } from "../api/use-order-shipment-actions";
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
  const orders = toDeliveryOrderCards(
    pages.flatMap((page) => page.items),
    {
      labels: {
        badge: (key) => tBadge(key),
        orderStatus: (key) => t(`orderStatus.${key}`),
        seriesPosition: (position, total) => tLibraryCard("seriesPosition", { position, total }),
      },
      locale,
    },
  );

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
  const totalText =
    summaryData && summaryData.activeBooksTotalByCurrency.length > 0
      ? summaryData.activeBooksTotalByCurrency
          .map((entry) => `${new Intl.NumberFormat(locale).format(entry.total)} ${entry.currency}`)
          .join(" · ")
      : "—";

  const mobileLabels = (key: "active" | "delayed" | "expectedThisWeek" | "stores" | "total") => ({
    compact: tSummary(`mobile.compact.${key}`),
    detailed: tSummary(`mobile.detailed.${key}`),
  });

  const summaryCards: LibrarySummaryCard[] = [
    {
      icon: "truck",
      iconTone: "primary",
      label: tSummary("active"),
      mobileLabels: mobileLabels("active"),
      value: (summaryData?.activeBooksCount ?? 0).toLocaleString(locale),
    },
    {
      icon: "clock",
      iconTone: "info",
      label: tSummary("expectedThisWeek"),
      mobileLabels: mobileLabels("expectedThisWeek"),
      value: (summaryData?.expectedThisWeekCount ?? 0).toLocaleString(locale),
    },
    {
      icon: "alert-triangle",
      iconTone: "favorite",
      label: tSummary("delayed"),
      mobileLabels: mobileLabels("delayed"),
      value: (summaryData?.delayedCount ?? 0).toLocaleString(locale),
    },
    {
      icon: "wallet",
      iconTone: "success",
      label: tSummary("total"),
      mobileLabels: mobileLabels("total"),
      value: totalText,
    },
    {
      icon: "store",
      iconTone: "ink",
      label: tSummary("stores"),
      mobileLabels: mobileLabels("stores"),
      value: (summaryData?.uniqueStoresCount ?? 0).toLocaleString(locale),
    },
  ];

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
            counterLabel={t("counter", { count: totalCount })}
            filter={params.filter}
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
