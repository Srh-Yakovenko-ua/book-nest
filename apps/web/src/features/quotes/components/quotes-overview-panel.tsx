"use client";

import type { Nullable, QuoteView } from "@app/shared";

import { useTranslations } from "next-intl";
import { useState } from "react";

import type { MobilePageOverviewTab } from "@/components/ui/mobile-page-overview-panel";
import type { LibrarySummaryCard } from "@/features/books/components/library-summary-cards";

import {
  MobilePageOverviewPanel,
  MobilePageOverviewTrigger,
  useMobilePageOverviewPanel,
} from "@/components/ui/mobile-page-overview-panel";
import { LibrarySummaryDetails } from "@/features/books/components/library-summary-mobile";

import { PostFinishQuotesBlock } from "./post-finish-quotes-block";
import { QuoteRediscoveryBlock } from "./quote-rediscovery-block";
import { QuoteFullViewDialog } from "./quote/quote-full-view-dialog";
import { QuotesQuickActions } from "./quotes-sidebar";

type QuotesOverviewPanelProps = {
  isLoading: boolean;
  onAddQuote: () => void;
  onClearFilters: () => void;
  onShowFavorites: () => void;
  onShowRecent: () => void;
  onShowWithComment: () => void;
  summaryCards: LibrarySummaryCard[];
};

export function QuotesOverviewPanel({
  isLoading,
  onAddQuote,
  onClearFilters,
  onShowFavorites,
  onShowRecent,
  onShowWithComment,
  summaryCards,
}: QuotesOverviewPanelProps) {
  const t = useTranslations("quotes.overviewPanel");
  const tDetails = useTranslations("quotes.summary.mobile");
  const panel = useMobilePageOverviewPanel();
  const [fullViewQuote, setFullViewQuote] = useState<Nullable<QuoteView>>(null);

  const tabs: MobilePageOverviewTab[] = [
    {
      content: (
        <div className="flex flex-col gap-4">
          <LibrarySummaryDetails cards={summaryCards} title={tDetails("title")} />
          <QuoteRediscoveryBlock
            isVisible
            onOpenFullView={(quote) => panel.closeThen(() => setFullViewQuote(quote))}
          />
          <PostFinishQuotesBlock runAction={panel.closeThen} />
        </div>
      ),
      id: "overview",
      label: t("tabs.overview"),
    },
    {
      content: (
        <div className="flex flex-col gap-4">
          <QuotesQuickActions
            onAddQuote={() => panel.closeThen(onAddQuote)}
            onClearFilters={() => panel.closeThen(onClearFilters)}
            onShowFavorites={() => panel.closeThen(onShowFavorites)}
            onShowRecent={() => panel.closeThen(onShowRecent)}
            onShowWithComment={() => panel.closeThen(onShowWithComment)}
          />
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

      {fullViewQuote === null ? null : (
        <QuoteFullViewDialog
          bookHref={`/books/${fullViewQuote.bookId}`}
          onOpenChange={(open) => {
            if (!open) setFullViewQuote(null);
          }}
          open
          quote={fullViewQuote}
        />
      )}
    </>
  );
}
