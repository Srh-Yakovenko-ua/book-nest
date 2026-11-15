"use client";

import { useTranslations } from "next-intl";

import type { SummaryCard } from "@/components/catalog/summary-cards";
import type { MobilePageOverviewTab } from "@/components/ui/mobile-page-overview-panel";

import { SummaryDetails } from "@/components/catalog/summary-mobile";
import {
  MobilePageOverviewLink,
  MobilePageOverviewPanel,
  MobilePageOverviewTrigger,
  useMobilePageOverviewPanel,
} from "@/components/ui/mobile-page-overview-panel";

import type {
  LibraryOverviewBook,
  LibraryOverviewGenre,
  LibraryOverviewTag,
} from "./library-overview-blocks";

import {
  LibraryOverviewSection,
  LibraryRecentlyAddedBlock,
  LibraryTopGenresBlock,
  LibraryTopTagsBlock,
} from "./library-overview-blocks";

type LibraryOverviewPanelProps = {
  isLoading: boolean;
  recentlyAdded: LibraryOverviewBook[];
  summaryCards: SummaryCard[];
  topGenres: LibraryOverviewGenre[];
  topTags: LibraryOverviewTag[];
};

export function LibraryOverviewPanel({
  isLoading,
  recentlyAdded,
  summaryCards,
  topGenres,
  topTags,
}: LibraryOverviewPanelProps) {
  const t = useTranslations("books.library.overviewPanel");
  const tDetails = useTranslations("books.library.summary.mobile");
  const tBlocks = useTranslations("books.library.sidebar");
  const panel = useMobilePageOverviewPanel();

  const tabs: MobilePageOverviewTab[] = [
    {
      content: <SummaryDetails cards={summaryCards} title={tDetails("title")} />,
      id: "overview",
      label: t("tabs.overview"),
    },
    {
      content: (
        <div className="flex flex-col gap-4">
          <LibraryOverviewSection title={tBlocks("topGenres")}>
            <LibraryTopGenresBlock genres={topGenres} isLoading={isLoading} />
          </LibraryOverviewSection>
          <LibraryOverviewSection title={tBlocks("topTags")}>
            <LibraryTopTagsBlock isLoading={isLoading} tags={topTags} />
          </LibraryOverviewSection>
        </div>
      ),
      id: "taxonomy",
      label: t("tabs.taxonomy"),
    },
    {
      content: (
        <LibraryOverviewSection title={tBlocks("recentlyAdded")}>
          <LibraryRecentlyAddedBlock
            books={recentlyAdded}
            isLoading={isLoading}
            linkComponent={MobilePageOverviewLink}
          />
        </LibraryOverviewSection>
      ),
      id: "activity",
      label: t("tabs.activity"),
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
