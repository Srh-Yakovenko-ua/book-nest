"use client";

import type { SeriesDetailsView } from "@app/shared";

import { useTranslations } from "next-intl";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useState } from "react";
import { toast } from "sonner";

import type { PageTabsItem } from "@/components/page-tabs";

import { PageTabs, PageTabsPanel } from "@/components/page-tabs";
import { useRouter } from "@/i18n/navigation";

import { useDeleteSeries } from "../api/use-delete-series";
import { suggestedPartNumber } from "../model/series-details-derive";
import { AddBookToSeriesDialog } from "./add-book-to-series-dialog";
import { DeleteSeriesDialog } from "./delete-series-dialog";
import { EditSeriesDialog } from "./edit-series-dialog";
import { SeriesBooksTab } from "./series-books-tab";
import { SeriesDetailsAbout } from "./series-details-about";
import { SeriesDetailsHero } from "./series-details-hero";
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

  const deleteSeries = useDeleteSeries(details.id);

  const tabItems: PageTabsItem[] = [
    { label: t("tabs.books"), value: "books" },
    { label: t("tabs.about"), value: "about" },
  ];

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
          details={details}
          onAddBook={() => setAddOpen(true)}
          onDelete={() => setDeleteOpen(true)}
          onEdit={() => setEditOpen(true)}
        />

        <div className="details-sidebar-leaf flex flex-col gap-6 lg:hidden">
          <SeriesProgressCard details={details} />
        </div>

        <PageTabs
          items={tabItems}
          onValueChange={(value) => void setTab(value === "about" ? "about" : "books")}
          value={tab}
        >
          <PageTabsPanel className="flex flex-col gap-5" value="books">
            <SeriesBooksTab details={details} onAddBook={() => setAddOpen(true)} />
          </PageTabsPanel>
          <PageTabsPanel value="about">
            <SeriesDetailsAbout details={details} />
          </PageTabsPanel>
        </PageTabs>

        <div className="details-sidebar-leaf flex flex-col gap-6 lg:hidden">
          <SeriesStatsCard stats={details.stats} />
        </div>
      </div>

      <aside className="details-sidebar-leaf hidden flex-col gap-6 lg:flex">
        <SeriesProgressCard details={details} />
        <SeriesStatsCard stats={details.stats} />
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
        defaultPartNumber={suggestedPartNumber(details.books)}
        onOpenChange={setAddOpen}
        open={addOpen}
        seriesId={details.id}
      />
    </div>
  );
}
