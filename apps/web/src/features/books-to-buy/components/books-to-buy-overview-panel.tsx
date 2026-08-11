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

import type { WishlistBestOffer } from "../model/books-to-buy-derive";

import { WishlistBestOffersBlock, WishlistUnsetOwnershipBlock } from "./books-to-buy-sidebar";

type BooksToBuyOverviewPanelProps = {
  bestOffers: WishlistBestOffer[];
  isLoading: boolean;
  summaryCards: LibrarySummaryCard[];
};

export function BooksToBuyOverviewPanel({
  bestOffers,
  isLoading,
  summaryCards,
}: BooksToBuyOverviewPanelProps) {
  const t = useTranslations("booksToBuy.overviewPanel");
  const tDetails = useTranslations("booksToBuy.summary.mobile");
  const panel = useMobilePageOverviewPanel();

  const tabs: MobilePageOverviewTab[] = [
    {
      content: <LibrarySummaryDetails cards={summaryCards} title={tDetails("title")} />,
      id: "overview",
      label: t("tabs.overview"),
    },
    {
      badge: bestOffers.length,
      content: <WishlistBestOffersBlock bestOffers={bestOffers} isLoading={isLoading} />,
      id: "offers",
      label: t("tabs.offers"),
    },
    {
      content: <WishlistUnsetOwnershipBlock />,
      id: "attention",
      label: t("tabs.attention"),
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
