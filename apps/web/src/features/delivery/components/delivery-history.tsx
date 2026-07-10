"use client";

import type { Nullable } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { useReceiveDelivery } from "@/features/books/api/use-delivery";
import { useRouter } from "@/i18n/navigation";
import { ApiError } from "@/lib/http-client";

import type { DeliveryHistoryCardModel } from "../model/history-card-model";
import type { HistoryContent } from "./delivery-history-view";
import type { DeliverySummaryCard } from "./delivery-summary-cards";

import { useDeliverySync } from "../api/delivery-cache";
import { useHistoryList } from "../api/use-history-list";
import { useHistorySummary } from "../api/use-history-summary";
import { toHistoryCardModel } from "../model/history-card-model";
import { formatCurrencyTotals } from "../model/money-format";
import { useHistoryParams } from "../model/use-history-params";
import { DeliveryCancelDialog } from "./delivery-cancel-dialog";
import { DeliveryEditDialog } from "./delivery-edit-dialog";
import { DeliveryHistoryCard } from "./delivery-history-card";
import { DeliveryHistoryToolbar } from "./delivery-history-toolbar";
import { DeliveryHistoryView } from "./delivery-history-view";
import { DeliverySummaryCards } from "./delivery-summary-cards";

export function DeliveryHistory() {
  const t = useTranslations("delivery.history");
  const tSummary = useTranslations("delivery.history.summary");
  const tCard = useTranslations("delivery.card");
  const tBadge = useTranslations("delivery.badge");
  const tToast = useTranslations("delivery.toast");
  const locale = useLocale();
  const router = useRouter();

  const params = useHistoryParams();
  const listQuery = useHistoryList(params.listParams);
  const summaryQuery = useHistorySummary();
  const receiveDelivery = useReceiveDelivery();
  const sync = useDeliverySync();

  const [editBookId, setEditBookId] = useState<Nullable<string>>(null);
  const [cancelBookId, setCancelBookId] = useState<Nullable<string>>(null);
  const [receivePendingBookId, setReceivePendingBookId] = useState<Nullable<string>>(null);

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

  function onReceive(model: DeliveryHistoryCardModel) {
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
        },
      },
    );
  }

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

  const summaryData = summaryQuery.data;
  const summaryCards: DeliverySummaryCard[] = [
    {
      icon: "package",
      label: tSummary("totalOrders"),
      value: (summaryData?.totalOrders ?? 0).toLocaleString(locale),
    },
    {
      icon: "truck",
      label: tSummary("active"),
      value: (summaryData?.activeCount ?? 0).toLocaleString(locale),
    },
    {
      icon: "check-circle",
      label: tSummary("received"),
      value: (summaryData?.receivedCount ?? 0).toLocaleString(locale),
    },
    {
      icon: "x-circle",
      label: tSummary("cancelled"),
      value: (summaryData?.cancelledCount ?? 0).toLocaleString(locale),
    },
    {
      icon: "wallet",
      label: tSummary("total"),
      value: summaryData ? formatCurrencyTotals(summaryData.totalByCurrency, locale) : "—",
    },
  ];

  const renderCard = (model: DeliveryHistoryCardModel) => (
    <DeliveryHistoryCard
      key={model.id}
      model={model}
      onCancel={() => setCancelBookId(model.bookId)}
      onEdit={() => setEditBookId(model.bookId)}
      onReceive={() => onReceive(model)}
      receivePending={receivePendingBookId === model.bookId}
    />
  );

  return (
    <>
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
        summary={<DeliverySummaryCards cards={summaryCards} isLoading={summaryQuery.isPending} />}
        toolbar={
          <DeliveryHistoryToolbar
            counterLabel={t("counter", { count: totalCount })}
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
    </>
  );
}
