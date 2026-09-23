"use client";

import type { LibraryPublisherDetail } from "@app/shared";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import type { PageTabsItem } from "@/components/page-tabs";

import { PageTabs, PageTabsPanel } from "@/components/page-tabs";
import { useRouter } from "@/i18n/navigation";

import { usePublisherOverview } from "../api/use-publisher-overview";
import { isPublisherDetailTab } from "../model/publisher-detail-url";
import { usePublisherDetailTab } from "../model/use-publisher-detail-tab";
import { DeletePublisherDialog } from "./delete-publisher-dialog";
import { EditPublisherDialog } from "./edit-publisher-dialog";
import { PublisherBooksTab } from "./publisher-books-tab";
import { PublisherDetailsHero } from "./publisher-details-hero";
import { PublisherOverviewTab } from "./publisher-overview-tab";
import { PublisherStatsGrid } from "./publisher-stats-grid";

type PublisherDetailsViewProps = {
  details: LibraryPublisherDetail;
};

export function PublisherDetailsView({ details }: PublisherDetailsViewProps) {
  const t = useTranslations("publishers.details.tabs");
  const router = useRouter();
  const { selectTab, tab } = usePublisherDetailTab();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const actionsMenuRef = useRef<HTMLButtonElement>(null);
  const overview = usePublisherOverview(details.id, {
    enabled: tab === "overview" && details.stats.booksCount > 0,
  });

  const tabItems: PageTabsItem[] = [
    { label: t("overview"), value: "overview" },
    { label: t("books"), value: "books" },
  ];

  const restoreActionsMenuFocus = (event: Event) => {
    event.preventDefault();
    actionsMenuRef.current?.focus();
  };

  const onAddBook = () => router.push(`/books/new?publisherId=${details.id}`);

  return (
    <div className="flex flex-col gap-6 motion-safe:animate-in motion-safe:duration-500 motion-safe:fill-mode-both motion-safe:fade-in motion-safe:slide-in-from-bottom-2">
      <PublisherDetailsHero
        actionsMenuRef={actionsMenuRef}
        details={details}
        onAddBook={onAddBook}
        onDelete={() => setDeleteOpen(true)}
        onEdit={() => setEditOpen(true)}
      />

      <PublisherStatsGrid stats={details.stats} />

      <PageTabs
        ariaLabel={t("ariaLabel")}
        items={tabItems}
        onValueChange={(value) => selectTab(isPublisherDetailTab(value) ? value : "overview")}
        value={tab}
      >
        <PageTabsPanel value="overview">
          <PublisherOverviewTab
            booksCount={details.stats.booksCount}
            onAddBook={onAddBook}
            overview={overview}
          />
        </PageTabsPanel>
        <PageTabsPanel value="books">
          <PublisherBooksTab onAddBook={onAddBook} publisherId={details.id} />
        </PageTabsPanel>
      </PageTabs>

      {details.isCustom ? (
        <>
          <EditPublisherDialog
            details={details}
            onCloseAutoFocus={restoreActionsMenuFocus}
            onOpenChange={setEditOpen}
            open={editOpen}
          />
          <DeletePublisherDialog
            booksCount={details.stats.booksCount}
            onCloseAutoFocus={restoreActionsMenuFocus}
            onGoToBooks={() => selectTab("books")}
            onOpenChange={setDeleteOpen}
            open={deleteOpen}
            publisherId={details.id}
            publisherName={details.name}
          />
        </>
      ) : null}
    </div>
  );
}
