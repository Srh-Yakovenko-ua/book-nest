"use client";

import type { BookOrderHistoryOutcomeView, CancelledFollowUpView, Nullable } from "@app/shared";
import type { ReactNode } from "react";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { LibraryOverviewSection } from "@/features/books/components/library-overview-blocks";

import type { DeliveryHistoryTab } from "../model/history-params";
import type { DeliveryLatestReceiptCardModel } from "../model/latest-receipt-card";

import { DeliveryCancelledDecisionBlock } from "./delivery-cancelled-decision-block";
import { DeliveryCancelledPlansBlock } from "./delivery-cancelled-plans-block";
import { DeliveryLatestReceiptCard } from "./delivery-latest-receipt-card";
import { DeliverySeriesOutcomeBlock } from "./delivery-series-outcome-block";
import { DeliveryUnreadReceivedBlock } from "./delivery-unread-received-block";

type DeliveryHistoryCancelledBlocksProps = {
  followUp: Nullable<CancelledFollowUpView>;
  isError: boolean;
  isLoading: boolean;
  onRetry: () => void;
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
  isError,
  isLoading,
  onRetry,
}: DeliveryHistoryCancelledBlocksProps) {
  if (isError) {
    return <CancelledFollowUpError onRetry={onRetry} />;
  }

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

function CancelledFollowUpError({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations("delivery.history.cancelledFollowUpError");

  return (
    <LibraryOverviewSection className="sidebar-card-leaf" title={t("title")}>
      <div className="flex flex-col items-start gap-3">
        <p className="text-xs text-muted-foreground">{t("description")}</p>
        <Button className="w-full" onClick={onRetry} size="sm" variant="secondary">
          <UiIcon aria-hidden name="refresh" size={16} />
          {t("retry")}
        </Button>
      </div>
    </LibraryOverviewSection>
  );
}
