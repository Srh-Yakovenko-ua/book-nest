"use client";

import type { ReactNode } from "react";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { UiIcon } from "@/components/icons";
import { TitleLeaf } from "@/components/title-leaf";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LibrarySummaryMobile } from "@/features/books/components/library-summary-mobile";

import type { NotesSidebarFilter } from "../model/notes-archive-query";

import { useNotesArchiveList } from "../api/use-notes-archive-list";
import { useNotesSummary } from "../api/use-notes-summary";
import { notesScopeFromQuery } from "../model/notes-archive-query";
import { useNotesArchiveQuery } from "../model/use-notes-archive-query";
import { useNotesSummaryCards } from "../model/use-notes-summary-cards";
import { NotesArchiveContent } from "./notes-archive-content";
import { NotesArchiveCreateFlow } from "./notes-archive-create-flow";
import { NotesArchiveOverviewPanel } from "./notes-archive-overview-panel";
import { NotesArchiveScopeChip } from "./notes-archive-scope-chip";
import { NotesArchiveSidebar } from "./notes-archive-sidebar";
import { NotesArchiveToolbar, NotesArchiveToolbarSkeleton } from "./notes-archive-toolbar";

const NOTES_MOBILE_TILE_COUNT = 3;

export function NotesArchiveView() {
  const t = useTranslations("notes.archive");
  const query = useNotesArchiveQuery();
  const notes = useNotesArchiveList(query.listQuery);
  const summary = useNotesSummary();

  const [isCreateOpen, setCreateOpen] = useState(false);

  const items = notes.data?.pages.flatMap((page) => page.items) ?? [];
  const totalCount = notes.data?.pages[0]?.totalCount ?? 0;
  const hasAnyNotes = (summary.data?.total ?? totalCount) > 0;
  const scope = notesScopeFromQuery(query.listQuery, items);
  const showOverview = !notes.isError && (notes.isPending || hasAnyNotes);
  const summaryCards = useNotesSummaryCards(summary.data);

  function onQuickFilter(filter: NotesSidebarFilter) {
    if (filter.kind === "filter") {
      query.setFilter(filter.value);
      return;
    }
    query.setCategory({ kind: "category", value: filter.value });
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-4 motion-safe:animate-in motion-safe:duration-500 motion-safe:fill-mode-both motion-safe:fade-in motion-safe:slide-in-from-bottom-1 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-heading text-[clamp(1.875rem,4vw,2.75rem)] leading-tight font-semibold text-ink">
              {t("title")}
            </h1>
            <TitleLeaf />
            {summary.data === undefined ? null : (
              <Badge variant="secondary">{t("countBadge", { count: summary.data.total })}</Badge>
            )}
          </div>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
            {t("subtitle")}
          </p>
        </div>
        <Button className="self-start sm:self-auto" onClick={() => setCreateOpen(true)}>
          <UiIcon name="plus" size={16} />
          {t("addNote")}
        </Button>
      </header>

      {showOverview ? (
        <LibrarySummaryMobile
          action={
            <NotesArchiveOverviewPanel
              isLoading={summary.isPending}
              onAddNote={() => setCreateOpen(true)}
              onQuickFilter={onQuickFilter}
              state={query.state}
              summaryCards={summaryCards}
            />
          }
          cards={summaryCards.slice(0, NOTES_MOBILE_TILE_COUNT)}
          className="sm:hidden"
          isLoading={summary.isPending}
        />
      ) : null}

      <ToolbarSlot
        hasAnyNotes={hasAnyNotes}
        isError={notes.isError}
        isPending={notes.isPending}
        toolbar={
          <NotesArchiveToolbar
            availableCustomCategories={summary.data?.availableCustomCategories ?? []}
            onCategoryChange={query.setCategory}
            onEntityTypeChange={query.setEntityType}
            onFilterChange={query.setFilter}
            onHasChapterChange={query.setHasChapter}
            onHasPageChange={query.setHasPage}
            onSearchChange={query.setSearch}
            onSortChange={query.setSort}
            state={query.state}
          />
        }
      />

      <div className="flex flex-col gap-8 xl:flex-row xl:items-start xl:gap-6">
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          {scope === null ? null : (
            <NotesArchiveScopeChip onClear={query.clearScope} scope={scope} />
          )}
          <NotesArchiveContent
            hasActiveFilters={query.hasActiveFilters}
            hasActiveSearch={query.hasActiveSearch}
            hasAnyNotes={hasAnyNotes}
            hasNextPage={notes.hasNextPage}
            isError={notes.isError}
            isFetchingNextPage={notes.isFetchingNextPage}
            isPending={notes.isPending}
            notes={items}
            onAddNote={() => setCreateOpen(true)}
            onClearFilters={query.clearFilters}
            onLoadMore={() => void notes.fetchNextPage()}
            onRetry={() => void notes.refetch()}
          />
        </div>

        {showOverview ? (
          <NotesArchiveSidebar
            isLoading={summary.isPending}
            onAddNote={() => setCreateOpen(true)}
            onQuickFilter={onQuickFilter}
            state={query.state}
            summaryCards={summaryCards}
          />
        ) : null}
      </div>

      <NotesArchiveCreateFlow onOpenChange={setCreateOpen} open={isCreateOpen} />
    </div>
  );
}

function ToolbarSlot({
  hasAnyNotes,
  isError,
  isPending,
  toolbar,
}: {
  hasAnyNotes: boolean;
  isError: boolean;
  isPending: boolean;
  toolbar: ReactNode;
}) {
  if (isError) return null;
  if (isPending) return <NotesArchiveToolbarSkeleton />;
  if (!hasAnyNotes) return null;
  return toolbar;
}
