"use client";

import { useTranslations } from "next-intl";

import type { LibrarySummaryCard } from "@/features/books/components/library-summary-cards";

import {
  MobilePageOverviewPanel,
  MobilePageOverviewTrigger,
  useMobilePageOverviewPanel,
} from "@/components/ui/mobile-page-overview-panel";
import { LibrarySummaryDetails } from "@/features/books/components/library-summary-mobile";

type DeliveryOverviewPanelProps = {
  detailsTitle: string;
  isLoading: boolean;
  summaryCards: LibrarySummaryCard[];
};

export function DeliveryOverviewPanel({
  detailsTitle,
  isLoading,
  summaryCards,
}: DeliveryOverviewPanelProps) {
  const t = useTranslations("delivery.overviewPanel");
  const panel = useMobilePageOverviewPanel();

  return (
    <>
      <MobilePageOverviewTrigger label={t("trigger")} onClick={() => panel.setOpen(true)} />

      <MobilePageOverviewPanel
        closeLabel={t("close")}
        loading={isLoading}
        panel={panel}
        subtitle={t("subtitle")}
        title={t("title")}
      >
        <LibrarySummaryDetails cards={summaryCards} title={detailsTitle} />
      </MobilePageOverviewPanel>
    </>
  );
}
