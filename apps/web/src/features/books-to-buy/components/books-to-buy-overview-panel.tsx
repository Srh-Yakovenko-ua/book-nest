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

import {
  WishlistBestOffersBlock,
  WishlistHowItWorksBlock,
  WishlistQuickActionsBlock,
  WishlistUnsetOwnershipBlock,
} from "./books-to-buy-sidebar";

type BooksToBuyOverviewPanelProps = {
  bestOffers: WishlistBestOffer[];
  isLoading: boolean;
  onShowBestOffers: () => void;
  summaryCards: LibrarySummaryCard[];
};

export function BooksToBuyOverviewPanel({
  bestOffers,
  isLoading,
  onShowBestOffers,
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
      content: (
        <div className="flex flex-col gap-4">
          <WishlistBestOffersBlock
            bestOffers={bestOffers}
            isLoading={isLoading}
            onShowBestOffers={() => panel.closeThen(onShowBestOffers)}
          />
        </div>
      ),
      id: "offers",
      label: t("tabs.offers"),
    },
    {
      content: (
        <div className="flex flex-col gap-4">
          <WishlistUnsetOwnershipBlock />
          <WishlistQuickActionsBlock />
          <WishlistHowItWorksBlock />
        </div>
      ),
      id: "actions",
      label: t("tabs.actions"),
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
