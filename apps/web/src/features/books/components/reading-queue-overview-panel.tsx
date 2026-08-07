"use client";

import type { ReadingQueueItemView } from "@app/shared";

import { useTranslations } from "next-intl";

import type { MobilePageOverviewTab } from "@/components/ui/mobile-page-overview-panel";

import {
  MobilePageOverviewPanel,
  MobilePageOverviewTrigger,
  useMobilePageOverviewPanel,
} from "@/components/ui/mobile-page-overview-panel";

import type { LibrarySummaryCard } from "./library-summary-cards";

import { LibrarySummaryDetails } from "./library-summary-mobile";
import { QueueVolumeBlock } from "./queue-volume-block";
import { SeriesOrderCheckBlock } from "./series-order-check-block";

type ReadingQueueOverviewPanelProps = {
  isLoading: boolean;
  items: ReadingQueueItemView[];
  seriesWithIssuesCount: number;
  summaryCards: LibrarySummaryCard[];
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
      content: <LibrarySummaryDetails cards={summaryCards} title={tDetails("title")} />,
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
