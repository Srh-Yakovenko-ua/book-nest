"use client";

import type { Nullable } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import type { LibrarySummaryCard } from "@/features/books/components/library-summary-cards";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { useReceiveDelivery } from "@/features/books/api/use-delivery";
import { useRouter } from "@/i18n/navigation";
import { ApiError } from "@/lib/http-client";

import type { DeliveryCardModel } from "../model/delivery-card-model";
import type { DeliveryContent } from "./delivery-in-transit-view";

import { useDeliverySync } from "../api/delivery-cache";
import { useInTransitList } from "../api/use-in-transit-list";
import { useInTransitSummary } from "../api/use-in-transit-summary";
import { toDeliveryCardModel } from "../model/delivery-card-model";
import { useInTransitParams } from "../model/use-in-transit-params";
import { DeliveryBulkBar } from "./delivery-bulk-bar";
import { DeliveryCancelDialog } from "./delivery-cancel-dialog";
import { DeliveryCard } from "./delivery-card";
import { DeliveryEditDialog } from "./delivery-edit-dialog";
import { DeliveryInTransitView } from "./delivery-in-transit-view";
import { DeliveryOverviewPanel } from "./delivery-overview-panel";
import { DeliveryReceiveDialog } from "./delivery-receive-dialog";
import { DeliverySummaryCards } from "./delivery-summary-cards";
import { DeliveryToolbar } from "./delivery-toolbar";

export function DeliveryInTransit() {
  const t = useTranslations("delivery");
  const tSummary = useTranslations("delivery.summary");
  const tCard = useTranslations("delivery.card");
  const tBadge = useTranslations("delivery.badge");
  const tToast = useTranslations("delivery.toast");
  const locale = useLocale();
  const router = useRouter();

  const params = useInTransitParams();
  const listQuery = useInTransitList(params.listParams);
  const summaryQuery = useInTransitSummary();
  const receiveDelivery = useReceiveDelivery();
  const sync = useDeliverySync();

  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());
  const [editBookId, setEditBookId] = useState<Nullable<string>>(null);
  const [cancelBookId, setCancelBookId] = useState<Nullable<string>>(null);
  const [receiveTarget, setReceiveTarget] = useState<Nullable<string[]>>(null);
  const [receivePendingBookId, setReceivePendingBookId] = useState<Nullable<string>>(null);

  const pages = listQuery.data?.pages ?? [];
  const totalCount = pages[0]?.totalCount ?? 0;
  const items: DeliveryCardModel[] = pages
    .flatMap((page) => page.items)
    .map((item) =>
      toDeliveryCardModel(item, {
        labels: {
          badge: (key) => tBadge(key),
          seriesPart: ({ name, part }) => tCard("seriesPart", { name, part }),
        },
        locale,
      }),
    );

  const visibleBookIds = items.map((model) => model.bookId);
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

  function toggleSelectAll() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) visibleBookIds.forEach((id) => next.delete(id));
      else visibleBookIds.forEach((id) => next.add(id));
      return next;
    });
  }

  function onReceive(model: DeliveryCardModel) {
    setReceivePendingBookId(model.bookId);
    receiveDelivery.mutate(
      { deliveryId: model.deliveryId, id: model.bookId },
      {
        onError: (error) => {
          toast.error(error instanceof ApiError ? error.message : tToast("error"));
          setReceivePendingBookId(null);
        },
        onSuccess: () => {
          toast.success(tToast("received"));
          sync();
          setReceivePendingBookId(null);
          setSelectedIds((prev) => {
            const next = new Set(prev);
            next.delete(model.bookId);
            return next;
          });
        },
      },
    );
  }

  const content: DeliveryContent = listQuery.isError
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

  const summaryData = summaryQuery.data;
  const totalText =
    summaryData && summaryData.totalByCurrency.length > 0
      ? summaryData.totalByCurrency
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
      value: (summaryData?.activeCount ?? 0).toLocaleString(locale),
    },
    {
      icon: "clock",
      iconTone: "info",
      label: tSummary("expectedThisWeek"),
      mobileLabels: mobileLabels("expectedThisWeek"),
      value: (summaryData?.expectedThisWeek ?? 0).toLocaleString(locale),
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
      value: (summaryData?.uniqueStores ?? 0).toLocaleString(locale),
    },
  ];

  const renderCard = (model: DeliveryCardModel) => (
    <DeliveryCard
      key={model.id}
      model={model}
      onCancel={() => setCancelBookId(model.bookId)}
      onEdit={() => setEditBookId(model.bookId)}
      onReceive={() => onReceive(model)}
      onToggleSelect={() => toggleSelect(model.bookId)}
      receivePending={receivePendingBookId === model.bookId}
      selected={selectedIds.has(model.bookId)}
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
              onReceive={() => setReceiveTarget(selectedVisible)}
            />
          ) : null
        }
        content={content}
        headerActions={
          items.length > 0 ? (
            <Button onClick={() => setReceiveTarget(visibleBookIds)} variant="secondary">
              <UiIcon name="check-circle" size={16} />
              {t("actions.receiveAll")}
            </Button>
          ) : null
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
          items.length > 0
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

      {editBookId === null ? null : (
        <DeliveryEditDialog
          bookId={editBookId}
          onOpenChange={(open) => {
            if (!open) setEditBookId(null);
          }}
          open
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
          bookIds={receiveTarget}
          onOpenChange={(open) => {
            if (!open) setReceiveTarget(null);
          }}
          onReceived={() => setSelectedIds(new Set())}
          open
        />
      )}
    </>
  );
}
