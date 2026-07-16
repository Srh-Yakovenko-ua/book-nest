"use client";

import type { BookView } from "@app/shared";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

type DetailTab = "history" | "overview";

export function BookDetailsView({ book }: BookDetailsViewProps) {
  const t = useTranslations("books.details");
  const [tab, setTab] = useState<DetailTab>("overview");

  return (
    <div className="grid gap-6 motion-safe:animate-in motion-safe:duration-500 motion-safe:fill-mode-both motion-safe:fade-in motion-safe:slide-in-from-bottom-2 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-8">
      <div className="flex min-w-0 flex-col gap-6">
        <BookDetailsHero book={book} />
        <BookDetailsSeriesSequence book={book} />

        <Tabs
          onValueChange={(value) => setTab(value === "history" ? "history" : "overview")}
          value={tab}
        >
          <TabsList>
            <TabsTrigger value="overview">{t("reading.tabOverview")}</TabsTrigger>
            <TabsTrigger value="history">{t("readingHistory.tab")}</TabsTrigger>
          </TabsList>
          <TabsContent className="flex flex-col gap-6" value="overview">
            <BookDetailsAbout book={book} />
            <ReadingProgressBlock book={book} onViewFullHistory={() => setTab("history")} />
            <BookDetailsEdition book={book} />
          </TabsContent>
          <TabsContent value="history">
            <ReadingHistoryTab book={book} isActive={tab === "history"} key={book.id} />
          </TabsContent>
        </Tabs>
      </div>

      <BookDetailsSidebar book={book} />
    </div>
  );
}
