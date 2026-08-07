"use client";

import { useTranslations } from "next-intl";

import type { MobilePageOverviewTab } from "@/components/ui/mobile-page-overview-panel";
import type { LibrarySummaryCard } from "@/features/books/components/library-summary-cards";

import {
  MobilePageOverviewPanel,
  MobilePageOverviewTrigger,
  useMobilePageOverviewPanel,
} from "@/components/ui/mobile-page-overview-panel";
import { LibrarySummaryDetails } from "@/features/books/components/library-summary-mobile";

import { QuotesQuickActions } from "./quotes-sidebar";

type QuotesOverviewPanelProps = {
  isLoading: boolean;
  onAddQuote: () => void;
  onClearFilters: () => void;
  onShowFavorites: () => void;
  onShowRecent: () => void;
  onShowWithComment: () => void;
  summaryCards: LibrarySummaryCard[];
};

export function QuotesOverviewPanel({
  isLoading,
  onAddQuote,
  onClearFilters,
  onShowFavorites,
  onShowRecent,
  onShowWithComment,
  summaryCards,
}: QuotesOverviewPanelProps) {
  const t = useTranslations("quotes.overviewPanel");
  const tDetails = useTranslations("quotes.summary.mobile");
  const panel = useMobilePageOverviewPanel();

  const tabs: MobilePageOverviewTab[] = [
    {
      content: <LibrarySummaryDetails cards={summaryCards} title={tDetails("title")} />,
      id: "overview",
      label: t("tabs.overview"),
    },
    {
      content: (
        <div className="flex flex-col gap-4">
          <QuotesQuickActions
            onAddQuote={() => panel.closeThen(onAddQuote)}
            onClearFilters={() => panel.closeThen(onClearFilters)}
            onShowFavorites={() => panel.closeThen(onShowFavorites)}
            onShowRecent={() => panel.closeThen(onShowRecent)}
            onShowWithComment={() => panel.closeThen(onShowWithComment)}
          />
        </div>
      ),
      id: "actions",
      label: t("tabs.actions"),
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
