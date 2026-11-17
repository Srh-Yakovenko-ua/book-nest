"use client";

import type { LibraryPublishersSummary } from "@app/shared";

import { useTranslations } from "next-intl";

import type { SummaryCard } from "@/components/catalog/summary-cards";
import type { MobilePageOverviewTab } from "@/components/ui/mobile-page-overview-panel";

import { SummaryDetails } from "@/components/catalog/summary-mobile";
import {
  MobilePageOverviewPanel,
  MobilePageOverviewTrigger,
  useMobilePageOverviewPanel,
} from "@/components/ui/mobile-page-overview-panel";

import { PublisherInsights } from "./publisher-insights";

type PublisherOverviewPanelProps = {
  isLoading: boolean;
  showInsights: boolean;
  summary: LibraryPublishersSummary | undefined;
  summaryCards: SummaryCard[];
};

export function PublisherOverviewPanel({
  isLoading,
  showInsights,
  summary,
  summaryCards,
}: PublisherOverviewPanelProps) {
  const t = useTranslations("publishers.overviewPanel");
  const tDetails = useTranslations("publishers.summary.mobile");
  const panel = useMobilePageOverviewPanel();

  const tabs: MobilePageOverviewTab[] = [
    {
      content: <SummaryDetails cards={summaryCards} title={tDetails("title")} />,
      id: "overview",
      label: t("tabs.overview"),
    },
  ];

  if (showInsights && summary !== undefined) {
    tabs.push({
      content: (
        <div className="flex flex-col gap-4">
          <PublisherInsights summary={summary} />
        </div>
      ),
      id: "insights",
      label: t("tabs.insights"),
    });
  }

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
