"use client";

import type { Nullable } from "@app/shared";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { assertNever } from "@/lib/assert-never";

import type { NotesArchiveScope } from "../model/notes-archive-config";
import type { UseNotesArchiveQueryResult } from "../model/use-notes-archive-query";
import type { NotesContextualColumn } from "./notes-archive-page-shell";

import { useNotesArchiveList } from "../api/use-notes-archive-list";
import { useNotesFacets } from "../api/use-notes-facets";
import { useNotesOverview } from "../api/use-notes-overview";
import { useNotesSummary } from "../api/use-notes-summary";
import { useIsWideViewport } from "../hooks/use-is-wide-viewport";
import { useNoteRediscoveryImpressions } from "../hooks/use-note-rediscovery-impression";
import { usePostFinishReview } from "../hooks/use-post-finish-review";
import { notesArchiveListState } from "../model/notes-archive-list-state";
import { hasContextualBlocks } from "../model/notes-overview";
import {
  useBookNotesArchiveQuery,
  useSeriesNotesArchiveQuery,
} from "../model/use-notes-archive-query";
import { useNotesSummaryCards } from "../model/use-notes-summary-cards";
import { NoteFormDialog } from "./note-form-dialog";
import { NotesArchiveContent } from "./notes-archive-content";
import { NotesArchivePageShell } from "./notes-archive-page-shell";
import { NotesArchiveToolbar, NotesArchiveToolbarSkeleton } from "./notes-archive-toolbar";
import { NotesContextualSidebar } from "./notes-contextual-sidebar";
import { NotesOverviewPanel } from "./notes-overview-panel";
import { NotesSummaryCards } from "./notes-summary-cards";

type NotesArchiveViewProps = {
  scope: NotesArchiveScope;
};

export function NotesArchiveView({ scope }: NotesArchiveViewProps) {
  switch (scope) {
    case "books":
      return <BookNotesArchive />;
    case "series":
      return <SeriesNotesArchive />;
    default:
      return assertNever(scope);
  }
}

function BookNotesArchive() {
  const query = useBookNotesArchiveQuery();
  return <NotesArchive query={query} />;
}

function NotesArchive({ query }: { query: UseNotesArchiveQueryResult }) {
  const t = useTranslations("notes.archive");
  const { config } = query;
  const notes = useNotesArchiveList(query.listParams);
  const facets = useNotesFacets(config.scope, query.datasetParams);
  const summary = useNotesSummary(config.scope);
  const overview = useNotesOverview(
    config.scope === "books" ? { scope: "books" } : { scope: "series", series: query.state.series },
  );
  const summaryCards = useNotesSummaryCards(config.scope, summary.data);
  const recordImpression = useNoteRediscoveryImpressions();
  const isWideViewport = useIsWideViewport();
  const archiveRef = useRef<Nullable<HTMLDivElement>>(null);
  const postFinishReview = usePostFinishReview((bookId) => {
    query.showBookNotes(bookId);
    if (!isWideViewport) archiveRef.current?.scrollIntoView({ block: "start" });
  });
  const [isCreateOpen, setCreateOpen] = useState(false);

  const contextualOverview =
    overview.data !== undefined && hasContextualBlocks(overview.data) ? overview.data : null;
  const listState = notesArchiveListState({
    hasActiveFilters: query.hasActiveFilters,
    hasActiveSearch: query.hasActiveSearch,
    list: notes,
  });

  const mobileOverview =
    summary.isError && contextualOverview === null ? null : (
      <NotesOverviewPanel
        isLoading={summary.isPending || overview.isPending}
        overview={contextualOverview}
        postFinishReview={postFinishReview}
        recordImpression={recordImpression}
        summaryCards={summary.isError ? null : summaryCards}
      />
    );

  return (
    <NotesArchivePageShell
      archive={
        <NotesArchiveContent
          onAddNote={() => setCreateOpen(true)}
          onClearFilters={query.clearAll}
          onLoadMore={() => void notes.fetchNextPage()}
          onRetry={() => void notes.refetch()}
          state={listState}
          view={query.state.view}
        />
      }
      archiveRef={archiveRef}
      contextual={contextualColumn()}
      createLabel={t("addNote")}
      dialogs={
        <NoteFormDialog
          onOpenChange={setCreateOpen}
          open={isCreateOpen}
          target={{ entityType: config.entityType, mode: "pick" }}
        />
      }
      onCreate={() => setCreateOpen(true)}
      resultsTitle={t("resultsTitle")}
      subtitle={t(`${config.scope}.subtitle`)}
      summary={
        <NotesSummaryCards
          cards={summaryCards}
          isError={summary.isError}
          isLoading={summary.isPending}
          mobileAction={mobileOverview}
        />
      }
      title={t(`${config.scope}.title`)}
      toolbar={
        notes.isPending ? (
          <NotesArchiveToolbarSkeleton />
        ) : (
          <NotesArchiveToolbar counter={archiveCounter()} facets={facets.data} query={query} />
        )
      }
    />
  );

  function archiveCounter(): Nullable<string> {
    if (listState.kind !== "ready") return null;
    const total = notes.data?.pages[0]?.totalCount ?? listState.notes.length;
    return t("counter", { shown: listState.notes.length, total });
  }

  function contextualColumn(): NotesContextualColumn {
    if (!isWideViewport) return { kind: "hidden" };
    if (overview.isPending) return { kind: "loading" };
    if (contextualOverview === null) return { kind: "hidden" };
    return {
      content: (
        <NotesContextualSidebar
          overview={contextualOverview}
          postFinishReview={postFinishReview}
          recordImpression={recordImpression}
        />
      ),
      kind: "visible",
    };
  }
}

function SeriesNotesArchive() {
  const query = useSeriesNotesArchiveQuery();
  return <NotesArchive query={query} />;
}
