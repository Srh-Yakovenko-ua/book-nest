"use client";

import { useTranslations } from "next-intl";

import type { MobilePageOverviewTab } from "@/components/ui/mobile-page-overview-panel";

import {
  MobilePageOverviewPanel,
  MobilePageOverviewTrigger,
  useMobilePageOverviewPanel,
} from "@/components/ui/mobile-page-overview-panel";

import type { LibrarySummaryCard } from "./library-summary-cards";

import { FavoriteSeriesContinuationsBlock } from "./favorite-series-continuations-block";
import { FavoriteTopGenresBlock } from "./favorite-top-genres-block";
import { FavoritesUnratedBlock } from "./favorites-unrated-block";
import { LibrarySummaryDetails } from "./library-summary-mobile";

type FavoritesOverviewPanelProps = {
  isLoading: boolean;
  summaryCards: LibrarySummaryCard[];
  unrated: number;
};

export function FavoritesOverviewPanel({
  isLoading,
  summaryCards,
  unrated,
}: FavoritesOverviewPanelProps) {
  const t = useTranslations("favorites.overviewPanel");
  const tDetails = useTranslations("favorites.summary.mobile");
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
          <FavoritesUnratedBlock unrated={unrated} />
          <FavoriteSeriesContinuationsBlock />
        </div>
      ),
      id: "collections",
      label: t("tabs.collections"),
    },
    {
      content: <FavoriteTopGenresBlock />,
      id: "genres",
      label: t("tabs.genres"),
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
