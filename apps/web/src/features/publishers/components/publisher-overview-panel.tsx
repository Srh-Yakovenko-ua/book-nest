"use client";

import type { LibraryPublishersSummary } from "@app/shared";

import { useTranslations } from "next-intl";

import type { MobilePageOverviewTab } from "@/components/ui/mobile-page-overview-panel";
import type { LibrarySummaryCard } from "@/features/books/components/library-summary-cards";

import {
  MobilePageOverviewPanel,
  MobilePageOverviewTrigger,
  useMobilePageOverviewPanel,
} from "@/components/ui/mobile-page-overview-panel";
import { LibrarySummaryDetails } from "@/features/books/components/library-summary-mobile";

import { PublisherInsights } from "./publisher-insights";

type PublisherOverviewPanelProps = {
  isLoading: boolean;
  showInsights: boolean;
  summary: LibraryPublishersSummary | undefined;
  summaryCards: LibrarySummaryCard[];
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
      content: <LibrarySummaryDetails cards={summaryCards} title={tDetails("title")} />,
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
