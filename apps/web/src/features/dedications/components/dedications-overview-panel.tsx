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

import { DedicationsAboutSections } from "./dedications-sidebar";

type DedicationsOverviewPanelProps = {
  isLoading: boolean;
  onChooseBook: () => void;
  summaryCards: LibrarySummaryCard[];
};

export function DedicationsOverviewPanel({
  isLoading,
  onChooseBook,
  summaryCards,
}: DedicationsOverviewPanelProps) {
  const t = useTranslations("dedications.overviewPanel");
  const tDetails = useTranslations("dedications.summary.mobile");
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
          <DedicationsAboutSections
            onChooseBook={() => {
              setOpen(false);
              onChooseBook();
            }}
          />
        </div>
      ),
      id: "about",
      label: t("tabs.about"),
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
