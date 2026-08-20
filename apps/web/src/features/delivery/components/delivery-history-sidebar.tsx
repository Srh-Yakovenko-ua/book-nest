"use client";

import type { BookOrderHistoryOutcomeView, CancelledFollowUpView, Nullable } from "@app/shared";
import type { ReactNode } from "react";

import { useTranslations } from "next-intl";

import type { DeliveryHistoryTab } from "../model/history-params";
import type { DeliveryLatestReceiptCardModel } from "../model/latest-receipt-card";

import { DeliveryCancelledDecisionBlock } from "./delivery-cancelled-decision-block";
import { DeliveryCancelledPlansBlock } from "./delivery-cancelled-plans-block";
import { DeliveryLatestReceiptCard } from "./delivery-latest-receipt-card";
import { DeliverySeriesOutcomeBlock } from "./delivery-series-outcome-block";
import { DeliveryUnreadReceivedBlock } from "./delivery-unread-received-block";

type DeliveryHistoryCancelledBlocksProps = {
  followUp: Nullable<CancelledFollowUpView>;
  isLoading: boolean;
};

type DeliveryHistoryReceivedBlocksProps = {
  isOutcomeLoading: boolean;
  isReceiptLoading: boolean;
  latestReceipt: Nullable<DeliveryLatestReceiptCardModel>;
  onRevealLatestReceipt: () => void;
  outcome: Nullable<BookOrderHistoryOutcomeView>;
  revealResetsFilters: boolean;
};

export function DeliveryHistoryCancelledBlocks({
  followUp,
  isLoading,
}: DeliveryHistoryCancelledBlocksProps) {
  return (
    <>
      <DeliveryCancelledDecisionBlock
        isLoading={isLoading}
        unresolved={followUp?.unresolved ?? null}
      />
      <DeliveryCancelledPlansBlock plans={followUp?.plans ?? null} />
    </>
  );
}

export function DeliveryHistoryReceivedBlocks({
  isOutcomeLoading,
  isReceiptLoading,
  latestReceipt,
  onRevealLatestReceipt,
  outcome,
  revealResetsFilters,
}: DeliveryHistoryReceivedBlocksProps) {
  return (
    <>
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
    </>
  );
}

export function DeliveryHistorySidebar({
  children,
  tab,
}: {
  children: ReactNode;
  tab: DeliveryHistoryTab;
}) {
  const t = useTranslations("delivery.history.sidebar");

  return (
    <aside
      aria-label={tab === "cancelled" ? t("cancelledTitle") : t("title")}
      className="flex flex-col gap-4 max-sm:hidden xl:sticky xl:top-6 xl:w-[19rem] xl:shrink-0"
    >
      {children}
    </aside>
  );
}
