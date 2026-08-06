"use client";

import type { Nullable } from "@app/shared";

import { useTranslations } from "next-intl";
import { useState } from "react";

import type { MobilePageOverviewTab } from "@/components/ui/mobile-page-overview-panel";
import type { LibrarySummaryCard } from "@/features/books/components/library-summary-cards";

import {
  MobilePageOverviewPanel,
  MobilePageOverviewTrigger,
} from "@/components/ui/mobile-page-overview-panel";
import { LibrarySummaryDetails } from "@/features/books/components/library-summary-mobile";

import type { ListAttentionReason } from "../model/lists-query";

import { ListsAttentionBlock, ListsTipBlock } from "./lists-sidebar";

type ListsOverviewPanelProps = {
  activeAttention: Nullable<ListAttentionReason>;
  attentionCounts: Record<ListAttentionReason, number>;
  isLoading: boolean;
  onAttentionSelect: (reason: ListAttentionReason) => void;
  summaryCards: LibrarySummaryCard[];
};

export function ListsOverviewPanel({
  activeAttention,
  attentionCounts,
  isLoading,
  onAttentionSelect,
  summaryCards,
}: ListsOverviewPanelProps) {
  const t = useTranslations("lists.catalog.overviewPanel");
  const tDetails = useTranslations("lists.catalog.summary.mobile");
  const [open, setOpen] = useState(false);

  const attentionTotal = Object.values(attentionCounts).reduce((sum, count) => sum + count, 0);

  const tabs: MobilePageOverviewTab[] = [
    {
      content: <LibrarySummaryDetails cards={summaryCards} title={tDetails("title")} />,
      id: "overview",
      label: t("tabs.overview"),
    },
    {
      badge: attentionTotal,
      content: (
        <div className="flex flex-col gap-4">
          <ListsAttentionBlock
            activeAttention={activeAttention}
            attentionCounts={attentionCounts}
            isLoading={isLoading}
            onAttentionSelect={(reason) => {
              onAttentionSelect(reason);
              setOpen(false);
            }}
          />
          <ListsTipBlock />
        </div>
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
