"use client";

import type { LibraryPublisherDetail } from "@app/shared";

import { useRef, useState } from "react";

import { useRouter } from "@/i18n/navigation";

import { usePublisherOverview } from "../api/use-publisher-overview";
import { usePublisherDetailUrlCleanup } from "../model/use-publisher-detail-url-cleanup";
import { DeletePublisherDialog } from "./delete-publisher-dialog";
import { EditPublisherDialog } from "./edit-publisher-dialog";
import { MergePublisherDialog } from "./merge-publisher-dialog";
import { PublisherBooksCatalog } from "./publisher-books-catalog";
import { PublisherBooksSidebar } from "./publisher-books-sidebar";
import { PublisherDetailsHero } from "./publisher-details-hero";
import { PublisherDetailsOverviewPanel } from "./publisher-details-overview-panel";
import { PublisherStatsGrid } from "./publisher-stats-grid";

type PublisherDetailsViewProps = {
  details: LibraryPublisherDetail;
};

export function PublisherDetailsView({ details }: PublisherDetailsViewProps) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const actionsMenuRef = useRef<HTMLButtonElement>(null);
  const hasBooks = details.stats.booksCount > 0;

  usePublisherDetailUrlCleanup();
  const overview = usePublisherOverview(details.id, { enabled: hasBooks });

  const restoreActionsMenuFocus = (event: Event) => {
    event.preventDefault();
    actionsMenuRef.current?.focus();
  };

  const keepFocusForMergeDialog = (event: Event) => event.preventDefault();

  const onAddBook = () => router.push(`/books/new?publisherId=${details.id}`);

  return (
    <div className="flex flex-col gap-6 motion-safe:animate-in motion-safe:duration-500 motion-safe:fill-mode-both motion-safe:fade-in motion-safe:slide-in-from-bottom-2">
      <PublisherDetailsHero
        actionsMenuRef={actionsMenuRef}
        details={details}
        onAddBook={onAddBook}
        onDelete={() => setDeleteOpen(true)}
        onEdit={() => setEditOpen(true)}
        onMerge={() => setMergeOpen(true)}
      />

      <PublisherStatsGrid stats={details.stats} />

      {hasBooks ? <PublisherDetailsOverviewPanel overview={overview} /> : null}

      <PublisherBooksCatalog
        onAddBook={onAddBook}
        publisherId={details.id}
        sidebar={hasBooks ? <PublisherBooksSidebar overview={overview} /> : undefined}
      />

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
            onCloseAutoFocus={mergeOpen ? keepFocusForMergeDialog : restoreActionsMenuFocus}
            onMerge={() => setMergeOpen(true)}
            onOpenChange={setDeleteOpen}
            open={deleteOpen}
            publisherId={details.id}
            publisherName={details.name}
          />
          <MergePublisherDialog
            booksCount={details.stats.booksCount}
            onCloseAutoFocus={restoreActionsMenuFocus}
            onOpenChange={setMergeOpen}
            open={mergeOpen}
            publisherId={details.id}
            publisherName={details.name}
          />
        </>
      ) : null}
    </div>
  );
}
