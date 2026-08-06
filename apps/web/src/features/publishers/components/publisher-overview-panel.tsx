"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import type { LibrarySummaryCard } from "@/features/books/components/library-summary-cards";

import {
  MobilePageOverviewPanel,
  MobilePageOverviewTrigger,
} from "@/components/ui/mobile-page-overview-panel";
import { LibrarySummaryDetails } from "@/features/books/components/library-summary-mobile";

type PublisherOverviewPanelProps = {
  isLoading: boolean;
  summaryCards: LibrarySummaryCard[];
};

export function PublisherOverviewPanel({ isLoading, summaryCards }: PublisherOverviewPanelProps) {
  const t = useTranslations("publishers.overviewPanel");
  const tDetails = useTranslations("publishers.summary.mobile");
  const [open, setOpen] = useState(false);

  return (
    <>
      <MobilePageOverviewTrigger label={t("trigger")} onClick={() => setOpen(true)} />

      <MobilePageOverviewPanel
        closeLabel={t("close")}
        loading={isLoading}
        onOpenChange={setOpen}
        open={open}
        subtitle={t("subtitle")}
        title={t("title")}
      >
        <LibrarySummaryDetails cards={summaryCards} title={tDetails("title")} />
      </MobilePageOverviewPanel>
    </>
  );
}
