"use client";

import type { SeriesDetailsView } from "@app/shared";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link, useRouter } from "@/i18n/navigation";

import { useDeleteSeries } from "../api/use-delete-series";
import { suggestedPartNumber } from "../model/series-details-derive";
import { AddBookToSeriesDialog } from "./add-book-to-series-dialog";
import { DeleteSeriesDialog } from "./delete-series-dialog";
import { EditSeriesDialog } from "./edit-series-dialog";
import { SeriesActionsCard } from "./series-actions-card";
import { SeriesBookRow } from "./series-book-row";
import { SeriesDetailsAbout } from "./series-details-about";
import { SeriesDetailsHero } from "./series-details-hero";
import { SeriesNextBookCard } from "./series-next-book-card";
import { SeriesProgressCard } from "./series-progress-card";
import { SeriesReadingOrder } from "./series-reading-order";
import { SeriesStatsCard } from "./series-stats-card";

type DetailTab = "about" | "books";

type SeriesDetailsViewProps = {
  details: SeriesDetailsView;
};

export function SeriesDetailsView({ details }: SeriesDetailsViewProps) {
  const t = useTranslations("series.details");
  const tToast = useTranslations("series.toast");
  const router = useRouter();

  const [tab, setTab] = useState<DetailTab>("books");
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const deleteSeries = useDeleteSeries(details.id);

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
    <div className="flex flex-col gap-6 motion-safe:animate-in motion-safe:duration-500 motion-safe:fill-mode-both motion-safe:fade-in motion-safe:slide-in-from-bottom-2 lg:gap-8">
      <Link
        className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:text-foreground"
        href="/series"
      >
        <UiIcon name="arrow-left" size={16} />
        {t("back")}
      </Link>

      <SeriesDetailsHero
        details={details}
        onAddBook={() => setAddOpen(true)}
        onDelete={() => setDeleteOpen(true)}
        onEdit={() => setEditOpen(true)}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start lg:gap-8">
        <div className="flex min-w-0 flex-col gap-6">
          <div className="flex flex-col gap-6 lg:hidden">
            <SeriesProgressCard details={details} />
            <SeriesNextBookCard details={details} />
          </div>

          <Tabs onValueChange={(value) => setTab(value as DetailTab)} value={tab}>
            <TabsList>
              <TabsTrigger value="books">{t("tabs.books")}</TabsTrigger>
              <TabsTrigger value="about">{t("tabs.about")}</TabsTrigger>
            </TabsList>
            <TabsContent className="flex flex-col gap-5" value="books">
              <SeriesBooksTab details={details} onAddBook={() => setAddOpen(true)} />
            </TabsContent>
            <TabsContent value="about">
              <SeriesDetailsAbout details={details} />
            </TabsContent>
          </Tabs>

          <div className="flex flex-col gap-6 lg:hidden">
            <SeriesStatsCard stats={details.stats} />
            <SeriesActionsCard
              onAddBook={() => setAddOpen(true)}
              onDelete={() => setDeleteOpen(true)}
              onEdit={() => setEditOpen(true)}
            />
          </div>
        </div>

        <aside className="hidden flex-col gap-6 lg:flex">
          <SeriesProgressCard details={details} />
          <SeriesNextBookCard details={details} />
          <SeriesStatsCard stats={details.stats} />
          <SeriesActionsCard
            onAddBook={() => setAddOpen(true)}
            onDelete={() => setDeleteOpen(true)}
            onEdit={() => setEditOpen(true)}
          />
        </aside>
      </div>

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
        defaultPartNumber={suggestedPartNumber(details.books)}
        onOpenChange={setAddOpen}
        open={addOpen}
        seriesId={details.id}
      />
    </div>
  );
}

function SeriesBooksTab({
  details,
  onAddBook,
}: {
  details: SeriesDetailsView;
  onAddBook: () => void;
}) {
  const t = useTranslations("series.details");

  if (details.books.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border px-6 py-12 text-center">
        <span className="grid size-12 place-items-center rounded-full bg-accent text-icon">
          <UiIcon name="book" size={24} />
        </span>
        <p className="text-sm font-medium text-ink">{t("booksEmpty.title")}</p>
        <Button onClick={onAddBook}>
          <UiIcon name="plus" size={16} />
          {t("booksEmpty.action")}
        </Button>
      </div>
    );
  }

  return (
    <>
      <h2 className="sr-only">{t("booksHeading")}</h2>
      <div className="flex flex-col gap-3">
        {details.books.map((book) => (
          <SeriesBookRow book={book} key={book.id} />
        ))}
      </div>
      <Button className="self-start" onClick={onAddBook} variant="outline">
        <UiIcon name="plus" size={16} />
        {t("addBookInline")}
      </Button>
      <SeriesReadingOrder books={details.books} />
    </>
  );
}
