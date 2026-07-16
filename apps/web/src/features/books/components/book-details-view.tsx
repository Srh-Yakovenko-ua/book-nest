"use client";

import type { BookView } from "@app/shared";

import { useTranslations } from "next-intl";
import { parseAsStringLiteral, useQueryState } from "nuqs";

import type { PageTabsItem } from "@/components/page-tabs";

import { PageTabs, PageTabsPanel } from "@/components/page-tabs";

import { BookDetailsAbout } from "./book-details-about";
import { BookDetailsEdition } from "./book-details-edition";
import { BookDetailsHero } from "./book-details-hero";
import { BookDetailsSeriesSequence } from "./book-details-series-sequence";
import { BookDetailsSidebar } from "./book-details-sidebar";
import { ReadingHistoryTab } from "./reading-history/reading-history-tab";
import { ReadingProgressBlock } from "./reading-progress/reading-progress-block";

type BookDetailsViewProps = {
  book: BookView;
};

const DETAIL_TABS = ["overview", "history"] as const;

const tabParser = parseAsStringLiteral(DETAIL_TABS).withDefault("overview");

export function BookDetailsView({ book }: BookDetailsViewProps) {
  const t = useTranslations("books.details");
  const [tab, setTab] = useQueryState("tab", tabParser);

  const items: PageTabsItem[] = [
    { label: t("reading.tabOverview"), value: "overview" },
    { label: t("readingHistory.tab"), value: "history" },
  ];

  return (
    <div className="grid gap-6 motion-safe:animate-in motion-safe:duration-500 motion-safe:fill-mode-both motion-safe:fade-in motion-safe:slide-in-from-bottom-2 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-8">
      <div className="flex min-w-0 flex-col gap-6">
        <BookDetailsHero book={book} />
        <BookDetailsSeriesSequence book={book} />

        <PageTabs
          items={items}
          onValueChange={(value) => void setTab(value === "history" ? "history" : "overview")}
          value={tab}
        >
          <PageTabsPanel className="flex flex-col gap-6" value="overview">
            <BookDetailsAbout book={book} />
            <ReadingProgressBlock book={book} onViewFullHistory={() => void setTab("history")} />
            <BookDetailsEdition book={book} />
          </PageTabsPanel>
          <PageTabsPanel value="history">
            <ReadingHistoryTab book={book} isActive={tab === "history"} key={book.id} />
          </PageTabsPanel>
        </PageTabs>
      </div>

      <BookDetailsSidebar book={book} />
    </div>
  );
}
