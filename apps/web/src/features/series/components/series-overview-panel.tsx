"use client";

import type { SeriesOverviewView, SeriesView } from "@app/shared";

import { useTranslations } from "next-intl";
import { useState } from "react";

import type { MobilePageOverviewTab } from "@/components/ui/mobile-page-overview-panel";
import type { LibrarySummaryCard } from "@/features/books/components/library-summary-cards";

import {
  MobilePageOverviewPanel,
  MobilePageOverviewTrigger,
} from "@/components/ui/mobile-page-overview-panel";
import { LibrarySummaryDetails } from "@/features/books/components/library-summary-mobile";

import type { SeriesAttentionFilter, SeriesAttentionReason } from "../model/series-derive";

import { SeriesAttentionBlock, SeriesProgressSections } from "./series-sidebar";

type SeriesOverviewPanelProps = {
  activeAttention: null | SeriesAttentionFilter;
  almostReadSeries: SeriesView[];
  attentionCounts: Record<SeriesAttentionReason, number>;
  attentionLoading: boolean;
  isError: boolean;
  isLoading: boolean;
  onAttentionSelect: (filter: SeriesAttentionFilter) => void;
  onRetry: () => void;
  overview: SeriesOverviewView | undefined;
  summaryCards: LibrarySummaryCard[];
};

export function SeriesOverviewPanel({
  activeAttention,
  almostReadSeries,
  attentionCounts,
  attentionLoading,
  isError,
  isLoading,
  onAttentionSelect,
  onRetry,
  overview,
  summaryCards,
}: SeriesOverviewPanelProps) {
  const t = useTranslations("series.overviewPanel");
  const tDetails = useTranslations("series.summary.mobile");
  const [open, setOpen] = useState(false);

  const attentionTotal = Object.values(attentionCounts).reduce((sum, count) => sum + count, 0);

  const tabs: MobilePageOverviewTab[] = [
    {
      content: <LibrarySummaryDetails cards={summaryCards} title={tDetails("title")} />,
      id: "overview",
      label: t("tabs.overview"),
    },
    {
      content: (
        <div className="flex flex-col gap-4">
          <SeriesProgressSections
            almostReadSeries={almostReadSeries}
            isError={isError}
            isLoading={isLoading}
            onRetry={onRetry}
            overview={overview}
          />
        </div>
      ),
      id: "progress",
      label: t("tabs.progress"),
    },
    {
      badge: attentionTotal,
      content: (
        <SeriesAttentionBlock
          activeAttention={activeAttention}
          counts={attentionCounts}
          isLoading={attentionLoading}
          onSelect={(filter) => {
            onAttentionSelect(filter);
            setOpen(false);
          }}
        />
      ),
      id: "attention",
      label: t("tabs.attention"),
    },
  ];

  return (
    <>
      <MobilePageOverviewTrigger label={t("trigger")} onClick={() => setOpen(true)} />

      <MobilePageOverviewPanel
        closeLabel={t("close")}
        loading={isLoading}
        onOpenChange={setOpen}
        open={open}
        subtitle={t("subtitle")}
        tabs={tabs}
        title={t("title")}
      />
    </>
  );
}
