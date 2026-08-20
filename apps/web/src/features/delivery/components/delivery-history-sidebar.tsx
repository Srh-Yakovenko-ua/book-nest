"use client";

import type { BookOrderHistoryOutcomeView, Nullable } from "@app/shared";

import { useTranslations } from "next-intl";

import type { DeliveryLatestReceiptCardModel } from "../model/latest-receipt-card";

import { DeliveryLatestReceiptCard } from "./delivery-latest-receipt-card";
import { DeliverySeriesOutcomeBlock } from "./delivery-series-outcome-block";
import { DeliveryUnreadReceivedBlock } from "./delivery-unread-received-block";

type DeliveryHistorySidebarProps = {
  isOutcomeLoading: boolean;
  isReceiptLoading: boolean;
  latestReceipt: Nullable<DeliveryLatestReceiptCardModel>;
  onRevealLatestReceipt: () => void;
  outcome: Nullable<BookOrderHistoryOutcomeView>;
  revealResetsFilters: boolean;
};

export function DeliveryHistorySidebar({
  isOutcomeLoading,
  isReceiptLoading,
  latestReceipt,
  onRevealLatestReceipt,
  outcome,
  revealResetsFilters,
}: DeliveryHistorySidebarProps) {
  const t = useTranslations("delivery.history.sidebar");

  return (
    <aside
      aria-label={t("title")}
      className="flex flex-col gap-4 max-sm:hidden xl:sticky xl:top-6 xl:w-[19rem] xl:shrink-0"
    >
      <DeliveryLatestReceiptCard
        isLoading={isReceiptLoading}
        model={latestReceipt}
        onReveal={onRevealLatestReceipt}
        resetsFilters={revealResetsFilters}
      />
      <DeliveryUnreadReceivedBlock
        isLoading={isOutcomeLoading}
        unreadReceived={outcome?.unreadReceived ?? null}
      />
      <DeliverySeriesOutcomeBlock insights={outcome?.seriesInsights ?? []} />
    </aside>
  );
}
