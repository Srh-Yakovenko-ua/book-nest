"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import type { MobilePageOverviewTab } from "@/components/ui/mobile-page-overview-panel";
import type { LibrarySummaryCard } from "@/features/books/components/library-summary-cards";

import {
  MobilePageOverviewPanel,
  MobilePageOverviewTrigger,
} from "@/components/ui/mobile-page-overview-panel";
import { LibrarySummaryDetails } from "@/features/books/components/library-summary-mobile";

import type { NearestReturn } from "../model/loans-derive";

import { LoansSidebarSections } from "./loans-sidebar";

type LoansOverviewPanelProps = {
  isLoading: boolean;
  nearest: NearestReturn[];
  onAddBook: () => void;
  summaryCards: LibrarySummaryCard[];
};

export function LoansOverviewPanel({
  isLoading,
  nearest,
  onAddBook,
  summaryCards,
}: LoansOverviewPanelProps) {
  const t = useTranslations("loans.overviewPanel");
  const tDetails = useTranslations("loans.summary.mobile");
  const [open, setOpen] = useState(false);

  const tabs: MobilePageOverviewTab[] = [
    {
      content: <LibrarySummaryDetails cards={summaryCards} title={tDetails("title")} />,
      id: "overview",
      label: t("tabs.overview"),
    },
    {
      content: (
        <div className="flex flex-col gap-4">
          <LoansSidebarSections
            isLoading={isLoading}
            nearest={nearest}
            onAddBook={() => {
              setOpen(false);
              onAddBook();
            }}
          />
        </div>
      ),
      id: "schedule",
      label: t("tabs.schedule"),
    },
  ];

  return (
    <>
      <MobilePageOverviewTrigger label={t("trigger")} onClick={() => setOpen(true)} />

      <MobilePageOverviewPanel
        closeLabel={t("close")}
        onOpenChange={setOpen}
        open={open}
        subtitle={t("subtitle")}
        tabs={tabs}
        title={t("title")}
      />
    </>
  );
}
