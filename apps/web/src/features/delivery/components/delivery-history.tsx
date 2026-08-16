"use client";

import type { Nullable } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import type { LibrarySummaryCard } from "@/features/books/components/library-summary-cards";

import { useReceiveDelivery } from "@/features/books/api/use-delivery";
import { useDeliveryErrorText } from "@/features/books/hooks/use-delivery-error-text";
import { useRouter } from "@/i18n/navigation";

import type { DeliveryHistoryCardModel } from "../model/history-card-model";
import type { HistoryContent } from "./delivery-history-view";

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
import { DeliveryOverviewPanel } from "./delivery-overview-panel";
import { DeliverySummaryCards } from "./delivery-summary-cards";

export function DeliveryHistory() {
  const t = useTranslations("delivery.history");
  const tSummary = useTranslations("delivery.history.summary");
  const tCard = useTranslations("delivery.card");
  const tBadge = useTranslations("delivery.badge");
  const tToast = useTranslations("delivery.toast");
  const deliveryErrorText = useDeliveryErrorText();
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
          toast.error(deliveryErrorText(error));
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
  const mobileLabels = (key: "active" | "cancelled" | "received" | "total" | "totalOrders") => ({
    compact: tSummary(`mobile.compact.${key}`),
    detailed: tSummary(`mobile.detailed.${key}`),
  });

  const summaryCards: LibrarySummaryCard[] = [
    {
      icon: "package",
      iconTone: "primary",
      label: tSummary("totalOrders"),
      mobileLabels: mobileLabels("totalOrders"),
      value: (summaryData?.ordersCount ?? 0).toLocaleString(locale),
    },
    {
      icon: "truck",
      iconTone: "info",
      label: tSummary("active"),
      mobileLabels: mobileLabels("active"),
      value: (summaryData?.activeBooksCount ?? 0).toLocaleString(locale),
    },
    {
      icon: "check-circle",
      iconTone: "success",
      label: tSummary("received"),
      mobileLabels: mobileLabels("received"),
      value: (summaryData?.receivedBooksCount ?? 0).toLocaleString(locale),
    },
    {
      icon: "x-circle",
      iconTone: "ink",
      label: tSummary("cancelled"),
      mobileLabels: mobileLabels("cancelled"),
      value: (summaryData?.cancelledBooksCount ?? 0).toLocaleString(locale),
    },
    {
      icon: "wallet",
      iconTone: "genre",
      label: tSummary("total"),
      mobileLabels: mobileLabels("total"),
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
