"use client";

import type { ListOverviewView, Nullable, RelatedListView } from "@app/shared";

import { useTranslations } from "next-intl";

import type { MobilePageOverviewTab } from "@/components/ui/mobile-page-overview-panel";
import type { LibrarySummaryCard } from "@/features/books/components/library-summary-cards";

import {
  MobilePageOverviewPanel,
  MobilePageOverviewTrigger,
  useMobilePageOverviewPanel,
} from "@/components/ui/mobile-page-overview-panel";
import { LibrarySummaryDetails } from "@/features/books/components/library-summary-mobile";
import { ListGoalCard } from "@/features/reading-goals";

import { ListAboutCard } from "./list-about-card";
import { ListCurrentlyReadingCard } from "./list-currently-reading-card";
import { ListRelatedCard } from "./list-related-card";

type ListDetailsOverviewPanelProps = {
  bookCount: number;
  isLoading: boolean;
  listId: string;
  listName: string;
  overview: Nullable<ListOverviewView>;
  relatedLists: RelatedListView[];
  summaryCards: LibrarySummaryCard[];
};

export function ListDetailsOverviewPanel({
  bookCount,
  isLoading,
  listId,
  listName,
  overview,
  relatedLists,
  summaryCards,
}: ListDetailsOverviewPanelProps) {
  const t = useTranslations("lists.details.overviewPanel");
  const tStats = useTranslations("lists.details.stats.mobile");
  const panel = useMobilePageOverviewPanel();

  const tabs: MobilePageOverviewTab[] = [];

  if (summaryCards.length > 0) {
    tabs.push({
      content: (
        <div className="flex flex-col gap-4">
          <LibrarySummaryDetails cards={summaryCards} title={tStats("title")} />
          <ListAboutCard overview={overview} />
        </div>
      ),
      id: "overview",
      label: t("tabs.overview"),
    });
  }

  tabs.push({
    content: (
      <div className="flex flex-col gap-4">
        <ListCurrentlyReadingCard overview={overview} />
        <ListGoalCard bookCount={bookCount} listId={listId} listName={listName} />
      </div>
    ),
    id: "reading",
    label: t("tabs.reading"),
  });

  if (relatedLists.length > 0) {
    tabs.push({
      badge: relatedLists.length,
      content: (
        <div className="flex flex-col gap-4">
          <ListRelatedCard lists={relatedLists} />
        </div>
      ),
      id: "related",
      label: t("tabs.related"),
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
