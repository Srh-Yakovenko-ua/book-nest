"use client";

import type { ReadingQueueItemView } from "@app/shared";

import { useTranslations } from "next-intl";

import type { SummaryCard } from "@/components/catalog/summary-cards";
import type { MobilePageOverviewTab } from "@/components/ui/mobile-page-overview-panel";

import { SummaryDetails } from "@/components/catalog/summary-mobile";
import {
  MobilePageOverviewPanel,
  MobilePageOverviewTrigger,
  useMobilePageOverviewPanel,
} from "@/components/ui/mobile-page-overview-panel";

import { QueueVolumeBlock } from "./queue-volume-block";
import { SeriesOrderCheckBlock } from "./series-order-check-block";

type ReadingQueueOverviewPanelProps = {
  isLoading: boolean;
  items: ReadingQueueItemView[];
  seriesWithIssuesCount: number;
  summaryCards: SummaryCard[];
};

export function ReadingQueueOverviewPanel({
  isLoading,
  items,
  seriesWithIssuesCount,
  summaryCards,
}: ReadingQueueOverviewPanelProps) {
  const t = useTranslations("readingQueue.overviewPanel");
  const tDetails = useTranslations("readingQueue.stats.mobile");
  const panel = useMobilePageOverviewPanel();

  const tabs: MobilePageOverviewTab[] = [
    {
      content: <SummaryDetails cards={summaryCards} title={tDetails("title")} />,
      id: "overview",
      label: t("tabs.overview"),
    },
    {
      content: <QueueVolumeBlock items={items} />,
      id: "volume",
      label: t("tabs.volume"),
    },
    {
      badge: seriesWithIssuesCount,
      content: <SeriesOrderCheckBlock />,
      id: "order",
      label: t("tabs.order"),
    },
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
