"use client";

import type { InTransitAttention, InTransitAttentionReason, Nullable } from "@app/shared";
import type { ReactNode } from "react";

import { useTranslations } from "next-intl";

import type { SummaryCard } from "@/components/catalog/summary-cards";
import type { MobilePageOverviewTab } from "@/components/ui/mobile-page-overview-panel";

import { SummaryDetails } from "@/components/catalog/summary-mobile";
import {
  MobilePageOverviewPanel,
  MobilePageOverviewTrigger,
  useMobilePageOverviewPanel,
} from "@/components/ui/mobile-page-overview-panel";

import { DeliveryAttentionBlock } from "./delivery-attention-block";

type DeliveryOverviewAttention = {
  activeReason: Nullable<InTransitAttentionReason>;
  items: readonly InTransitAttention[];
  onSelect: (reason: InTransitAttentionReason) => void;
};

type DeliveryOverviewPanelProps = {
  attention?: DeliveryOverviewAttention;
  detailsTitle: string;
  isLoading: boolean;
  sidebar?: DeliveryOverviewSidebar;
  summaryCards: SummaryCard[];
};

type DeliveryOverviewSidebar = {
  blocks: ReactNode;
  label: string;
};

export function DeliveryOverviewPanel({
  attention,
  detailsTitle,
  isLoading,
  sidebar,
  summaryCards,
}: DeliveryOverviewPanelProps) {
  const t = useTranslations("delivery.overviewPanel");
  const panel = useMobilePageOverviewPanel();

  const tabs: MobilePageOverviewTab[] = [
    {
      content: <SummaryDetails cards={summaryCards} title={detailsTitle} />,
      id: "overview",
      label: t("tabs.overview"),
    },
    ...(attention === undefined
      ? []
      : [
          {
            badge: attention.items.length,
            content: (
              <DeliveryAttentionBlock
                activeReason={attention.activeReason}
                attention={attention.items}
                isLoading={isLoading}
                onSelect={(reason) => panel.closeThen(() => attention.onSelect(reason))}
              />
            ),
            id: "attention",
            label: t("tabs.attention"),
          },
        ]),
    ...(sidebar === undefined
      ? []
      : [
          {
            content: <div className="flex flex-col gap-4">{sidebar.blocks}</div>,
            id: "sidebar",
            label: sidebar.label,
          },
        ]),
  ];

  return (
    <>
      <MobilePageOverviewTrigger label={t("trigger")} onClick={() => panel.setOpen(true)} />

      <MobilePageOverviewPanel
        closeLabel={t("close")}
        loading={isLoading}
        panel={panel}
        subtitle={t("subtitle")}
        tabs={tabs}
        title={t("title")}
      />
    </>
  );
}
