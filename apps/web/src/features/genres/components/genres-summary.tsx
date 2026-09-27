"use client";

import { useTranslations } from "next-intl";

import type { LibrarySummaryCard } from "@/features/books/components/library-summary-cards";

import {
  MobilePageOverviewPanel,
  MobilePageOverviewTrigger,
  useMobilePageOverviewPanel,
} from "@/components/ui/mobile-page-overview-panel";
import { LibrarySummaryCards } from "@/features/books/components/library-summary-cards";
import { LibrarySummaryDetails } from "@/features/books/components/library-summary-mobile";

type GenresSummaryProps = {
  cards: LibrarySummaryCard[];
  isLoading: boolean;
};

const GENRES_SUMMARY = {
  cardsCount: 6,
} as const;

export function GenresSummaryCards({ cards, isLoading }: GenresSummaryProps) {
  return (
    <div className="max-sm:hidden">
      <LibrarySummaryCards
        cards={cards}
        isLoading={isLoading}
        skeletonCount={GENRES_SUMMARY.cardsCount}
      />
    </div>
  );
}

export function GenresSummaryPanel({ cards, isLoading }: GenresSummaryProps) {
  const t = useTranslations("genres.summary.panel");
  const panel = useMobilePageOverviewPanel();

  return (
    <>
      <MobilePageOverviewTrigger label={t("trigger")} onClick={() => panel.setOpen(true)} />
      <MobilePageOverviewPanel
        closeLabel={t("close")}
        loading={isLoading}
        panel={panel}
        subtitle={t("subtitle")}
        title={t("title")}
      >
        <LibrarySummaryDetails cards={cards} title={t("detailsTitle")} />
      </MobilePageOverviewPanel>
    </>
  );
}
