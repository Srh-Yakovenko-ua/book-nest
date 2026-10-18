"use client";

import type { BookDetailsView as BookDetailsViewData } from "@app/shared";
import type { ReactNode } from "react";

import { useTranslations } from "next-intl";
import { parseAsStringLiteral, useQueryState } from "nuqs";

import type { PageTabsItem } from "@/components/page-tabs";

import { PageTabs, PageTabsPanel } from "@/components/page-tabs";
import { Badge } from "@/components/ui/badge";
import {
  BookCharactersTab,
  toCharacterBookContext,
  useBookCharacterSummary,
} from "@/features/characters";
import { BookNotesTab } from "@/features/notes";
import { BookQuotesTab } from "@/features/quotes";
import { BookTimelineBlock, useTimelineSummary } from "@/features/timeline";
import { useBookTabScrollMemory } from "@/hooks/use-book-tab-scroll-anchor";

import { BookDetailsAbout } from "./book-details-about";
import { BookDetailsEdition } from "./book-details-edition";
import { BookDetailsHero } from "./book-details-hero";
import { BookDetailsKeyFacts } from "./book-details-key-facts";
import { BookDetailsSeriesSequence } from "./book-details-series-sequence";
import { BookDetailsSidebar } from "./book-details-sidebar";
import { ReadingHistoryTab } from "./reading-history/reading-history-tab";
import { ReadingProgressBlock } from "./reading-progress/reading-progress-block";

type BookDetailsViewProps = {
  book: BookDetailsViewData;
};

const DETAIL_TABS = ["overview", "notes", "quotes", "history", "characters", "timeline"] as const;

type DetailTab = (typeof DETAIL_TABS)[number];

const tabParser = parseAsStringLiteral(DETAIL_TABS).withDefault("overview");

export function BookDetailsView({ book }: BookDetailsViewProps) {
  const t = useTranslations("books.details");
  const tCharacters = useTranslations("characters");
  const tNotes = useTranslations("notes");
  const tQuotes = useTranslations("quotes");
  const [tab, setTab] = useQueryState("tab", tabParser);
  const charactersSummary = useBookCharacterSummary(book.id, toCharacterBookContext(book));
  const charactersCount = charactersSummary.data?.totalVisibleCharacters ?? 0;
  const timelineSummaryQuery = useTimelineSummary(book.id);
  const notesScrollMemory = useBookTabScrollMemory(book.id);
  const quotesScrollMemory = useBookTabScrollMemory(book.id);

  function changeTab(nextTab: DetailTab) {
    if (tab === "notes" && nextTab !== "notes") notesScrollMemory.capture();
    if (tab === "quotes" && nextTab !== "quotes") quotesScrollMemory.capture();
    void setTab(nextTab);
  }

  const items: PageTabsItem[] = [
    { label: t("reading.tabOverview"), value: "overview" },
    { badge: tabCountBadge(book.notesCount), label: tNotes("bookTab.tab"), value: "notes" },
    { badge: tabCountBadge(book.quotesCount), label: tQuotes("bookTab.tab"), value: "quotes" },
    { label: t("readingHistory.tab"), value: "history" },
    { badge: tabCountBadge(charactersCount), label: tCharacters("tab"), value: "characters" },
    {
      label: t("timeline.tab", { count: timelineSummaryQuery.data?.totalEvents ?? 0 }),
      value: "timeline",
    },
  ];

  return (
    <div className="grid gap-6 motion-safe:animate-in motion-safe:duration-500 motion-safe:fill-mode-both motion-safe:fade-in motion-safe:slide-in-from-bottom-2 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-8">
      <div className="flex min-w-0 flex-col gap-6">
        <BookDetailsHero book={book} />
        <BookDetailsKeyFacts book={book} className="lg:hidden" />
        <BookDetailsSeriesSequence book={book} />

        <PageTabs
          items={items}
          onValueChange={(value) => changeTab(toDetailTab(value))}
          value={tab}
        >
          <PageTabsPanel className="flex flex-col gap-6" value="overview">
            <BookDetailsAbout book={book} />
            <ReadingProgressBlock book={book} onViewFullHistory={() => changeTab("history")} />
            <BookDetailsEdition book={book} />
          </PageTabsPanel>
          <PageTabsPanel value="notes">
            <BookNotesTab book={book} key={book.id} scrollMemory={notesScrollMemory} />
          </PageTabsPanel>
          <PageTabsPanel value="quotes">
            <BookQuotesTab book={book} key={book.id} scrollMemory={quotesScrollMemory} />
          </PageTabsPanel>
          <PageTabsPanel value="history">
            <ReadingHistoryTab book={book} isActive={tab === "history"} key={book.id} />
          </PageTabsPanel>
          <PageTabsPanel value="characters">
            <BookCharactersTab book={book} key={book.id} />
          </PageTabsPanel>
          <PageTabsPanel value="timeline">
            <BookTimelineBlock book={book} key={book.id} />
          </PageTabsPanel>
        </PageTabs>
      </div>

      <BookDetailsSidebar book={book} />
    </div>
  );
}

function tabCountBadge(count: number): ReactNode {
  if (count <= 0) return undefined;

  return (
    <>
      <span className="sr-only">, </span>
      <Badge className="ml-1.5" variant="secondary">
        {count}
      </Badge>
    </>
  );
}

function toDetailTab(value: string): DetailTab {
  return DETAIL_TABS.find((detailTab) => detailTab === value) ?? "overview";
}
