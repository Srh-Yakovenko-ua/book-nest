"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import type { MobilePageOverviewTab } from "@/components/ui/mobile-page-overview-panel";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { MobilePageOverviewPanel } from "@/components/ui/mobile-page-overview-panel";

import type { LibraryBookLinkComponent } from "../model/library-book";
import type {
  LibraryOverviewBook,
  LibraryOverviewGenre,
  LibraryOverviewTag,
} from "./library-overview-blocks";
import type { LibrarySummaryCard } from "./library-summary-cards";

import {
  LibraryOverviewSection,
  LibraryRecentlyAddedBlock,
  LibraryTopGenresBlock,
  LibraryTopTagsBlock,
} from "./library-overview-blocks";
import { LibrarySummaryDetails } from "./library-summary-mobile";

type LibraryOverviewPanelProps = {
  isLoading: boolean;
  linkComponent?: LibraryBookLinkComponent;
  recentlyAdded: LibraryOverviewBook[];
  summaryCards: LibrarySummaryCard[];
  topGenres: LibraryOverviewGenre[];
  topTags: LibraryOverviewTag[];
};

const BEYOND_MOBILE_QUERY = "(min-width: 40rem)";

export function LibraryOverviewPanel({
  isLoading,
  linkComponent,
  recentlyAdded,
  summaryCards,
  topGenres,
  topTags,
}: LibraryOverviewPanelProps) {
  const t = useTranslations("books.library.overviewPanel");
  const tDetails = useTranslations("books.library.summary.mobile");
  const tBlocks = useTranslations("books.library.sidebar");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    const beyondMobile = window.matchMedia(BEYOND_MOBILE_QUERY);

    function closeBeyondMobile() {
      if (beyondMobile.matches) setOpen(false);
    }

    closeBeyondMobile();
    beyondMobile.addEventListener("change", closeBeyondMobile);
    return () => beyondMobile.removeEventListener("change", closeBeyondMobile);
  }, [open]);

  const tabs: MobilePageOverviewTab[] = [
    {
      content: <LibrarySummaryDetails cards={summaryCards} title={tDetails("title")} />,
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
            linkComponent={linkComponent}
          />
        </LibraryOverviewSection>
      ),
      id: "activity",
      label: t("tabs.activity"),
    },
  ];

  return (
    <>
      <Button
        className="h-11 w-full justify-start gap-2 rounded-xl px-3.5 shadow-card"
        onClick={() => setOpen(true)}
        variant="secondary"
      >
        <UiIcon aria-hidden className="shrink-0 text-primary" name="chart" size={16} />
        <span className="flex-1 text-left font-heading text-sm font-semibold text-ink">
          {t("trigger")}
        </span>
        <UiIcon
          aria-hidden
          className="shrink-0 text-muted-foreground"
          name="chevron-right"
          size={16}
        />
      </Button>

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
