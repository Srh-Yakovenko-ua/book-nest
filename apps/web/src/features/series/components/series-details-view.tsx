"use client";

import type { SeriesDetailsView } from "@app/shared";

import { useTranslations } from "next-intl";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { Tabs as TabsPrimitive } from "radix-ui";
import { useState } from "react";
import { toast } from "sonner";

import type { PageTabsItem } from "@/components/page-tabs";

import {
  pageTabsDividerClass,
  pageTabsListClass,
  PageTabsPanel,
  pageTabsTriggerClass,
} from "@/components/page-tabs";
import { SeriesNotesBlock } from "@/features/notes";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

import { useDeleteSeries } from "../api/use-delete-series";
import { seriesProgress } from "../model/series-derive";
import { nextAddablePartNumber, suggestedPartNumber } from "../model/series-details-derive";
import { AddBookToSeriesDialog } from "./add-book-to-series-dialog";
import { DeleteSeriesDialog } from "./delete-series-dialog";
import { EditSeriesDialog } from "./edit-series-dialog";
import { SeriesBooksSummary } from "./series-books-summary";
import { SeriesBooksTab } from "./series-books-tab";
import { SeriesDetailsAbout } from "./series-details-about";
import { SeriesDetailsHero } from "./series-details-hero";
import { SeriesOrderCheckToggle } from "./series-order-check-toggle";
import { SeriesProgressCard } from "./series-progress-card";
import { SeriesStatsCard } from "./series-stats-card";

type SeriesDetailsViewProps = {
  details: SeriesDetailsView;
};

const DETAIL_TABS = ["books", "about"] as const;

const tabParser = parseAsStringLiteral(DETAIL_TABS).withDefault("books");

export function SeriesDetailsView({ details }: SeriesDetailsViewProps) {
  const t = useTranslations("series.details");
  const tToast = useTranslations("series.toast");
  const router = useRouter();

  const [tab, setTab] = useQueryState("tab", tabParser);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addPartNumber, setAddPartNumber] = useState<null | number>(null);

  const deleteSeries = useDeleteSeries(details.id);
  const { fullyRead } = seriesProgress(details);

  const nextPart = nextAddablePartNumber({ books: details.books, totalBooks: details.totalBooks });
  const canAddBook = nextPart !== null;

  const tabItems: PageTabsItem[] = [
    { label: t("tabs.books"), value: "books" },
    { label: t("tabs.about"), value: "about" },
  ];

  function openAddBook(partNumber: null | number) {
    setAddPartNumber(partNumber);
    setAddOpen(true);
  }

  function onConfirmDelete() {
    deleteSeries.mutate(undefined, {
      onError: () => toast.error(tToast("error")),
      onSuccess: () => {
        toast.success(tToast("deleted"));
        setDeleteOpen(false);
        router.push("/series");
      },
    });
  }

  return (
    <div className="grid gap-6 motion-safe:animate-in motion-safe:duration-500 motion-safe:fill-mode-both motion-safe:fade-in motion-safe:slide-in-from-bottom-2 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start lg:gap-8">
      <div className="flex min-w-0 flex-col gap-6">
        <SeriesDetailsHero
          canAddBook={canAddBook}
          details={details}
          onAddBook={() => openAddBook(null)}
          onDelete={() => setDeleteOpen(true)}
          onEdit={() => setEditOpen(true)}
        />

        {fullyRead ? null : (
          <div className="details-sidebar-leaf flex flex-col gap-6 lg:hidden">
            <SeriesProgressCard details={details} />
          </div>
        )}

        <TabsPrimitive.Root
          className="flex flex-col gap-6"
          onValueChange={(value) => void setTab(value === "about" ? "about" : "books")}
          value={tab}
        >
          <div className={cn(pageTabsDividerClass, "flex items-end justify-between gap-4")}>
            <TabsPrimitive.List className={cn(pageTabsListClass, "min-w-0 flex-1")}>
              {tabItems.map((item) => (
                <TabsPrimitive.Trigger
                  className={pageTabsTriggerClass}
                  key={item.value}
                  value={item.value}
                >
                  {item.label}
                </TabsPrimitive.Trigger>
              ))}
            </TabsPrimitive.List>

            {tab === "books" && details.books.length > 0 ? (
              <div className="shrink-0 pb-2.5">
                <SeriesBooksSummary details={details} />
              </div>
            ) : null}
          </div>

          <PageTabsPanel className="flex flex-col gap-5" value="books">
            <SeriesBooksTab canAddBook={canAddBook} details={details} onAddBook={openAddBook} />
          </PageTabsPanel>
          <PageTabsPanel className="flex flex-col gap-6" value="about">
            <SeriesDetailsAbout details={details} />
            <SeriesNotesBlock details={details} />
          </PageTabsPanel>
        </TabsPrimitive.Root>

        <div className="details-sidebar-leaf flex flex-col gap-6 lg:hidden">
          <SeriesStatsCard stats={details.stats} totalBooks={details.totalBooks} />
          <SeriesOrderCheckToggle seriesId={details.id} />
        </div>
      </div>

      <aside className="details-sidebar-leaf hidden flex-col gap-6 lg:flex">
        {fullyRead ? null : <SeriesProgressCard details={details} />}
        <SeriesStatsCard stats={details.stats} totalBooks={details.totalBooks} />
        <SeriesOrderCheckToggle seriesId={details.id} />
      </aside>

      <EditSeriesDialog onOpenChange={setEditOpen} open={editOpen} series={details} />
      <DeleteSeriesDialog
        booksCount={details.booksInSeries}
        isDeleting={deleteSeries.isPending}
        onConfirm={onConfirmDelete}
        onOpenChange={(open) => {
          if (!open && !deleteSeries.isPending) setDeleteOpen(false);
        }}
        open={deleteOpen}
      />
      <AddBookToSeriesDialog
        defaultPartNumber={addPartNumber ?? nextPart ?? suggestedPartNumber(details.books)}
        onOpenChange={setAddOpen}
        open={addOpen}
        seriesId={details.id}
      />
    </div>
  );
}
