"use client";

import type { Nullable } from "@app/shared";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import type { LibraryPresence } from "@/features/books/api/use-library-presence";
import type { EmptyStateAction, EmptyStateEntry } from "@/lib/empty-states";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { useLibraryPresence } from "@/features/books/api/use-library-presence";
import { useRetryFocus } from "@/hooks/use-retry-focus";
import { useRouter } from "@/i18n/navigation";
import { assertNever } from "@/lib/assert-never";
import { collectionChrome } from "@/lib/collection-chrome";

import type { NotesArchiveScope } from "../model/notes-archive-config";
import type { NotesArchiveListState } from "../model/notes-archive-list-state";
import type { UseNotesArchiveQueryResult } from "../model/use-notes-archive-query";
import type { NotesContextualColumn } from "./notes-archive-page-shell";

import { useNotesArchiveList } from "../api/use-notes-archive-list";
import { useNotesFacets } from "../api/use-notes-facets";
import { useNotesOverview } from "../api/use-notes-overview";
import { useNotesSummary } from "../api/use-notes-summary";
import { useSeriesPresence } from "../api/use-series-presence";
import { useIsWideViewport } from "../hooks/use-is-wide-viewport";
import { useNoteRediscoveryImpressions } from "../hooks/use-note-rediscovery-impression";
import { usePostFinishReview } from "../hooks/use-post-finish-review";
import { NOTES_ENTITY_START_HREF } from "../model/notes-archive-config";
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
  const libraryPresence = useLibraryPresence();
  return <NotesArchive entityPresence={libraryPresence} query={query} />;
}

function NotesArchive({
  entityPresence,
  query,
}: {
  entityPresence: LibraryPresence;
  query: UseNotesArchiveQueryResult;
}) {
  const t = useTranslations("notes.archive");
  const tBooks = useTranslations("books");
  const tCommon = useTranslations("common");
  const router = useRouter();
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
  const resultsHeadingRef = useRef<Nullable<HTMLHeadingElement>>(null);
  const { retryButtonRef, withRetryFocus } = useRetryFocus(resultsHeadingRef);
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
  const archiveState = withEntityPresence({ listState, presence: entityPresence });
  const chrome = collectionChrome({
    baseTotal: summary.data?.notesCount,
    hasQuery: query.hasActiveFilters || query.hasActiveSearch,
  });
  const hasNoEntities = entityPresence.kind === "ready" && entityPresence.total === 0;
  const noEntitiesAction = {
    books: { icon: "plus", label: tBooks("firstBook.cta") },
    series: { icon: "layers", label: t("series.noEntities.cta") },
  } satisfies Record<NotesArchiveScope, EmptyStateAction>;
  const libraryEmptyState: EmptyStateEntry = hasNoEntities
    ? {
        desc: t(`${config.scope}.noEntities.description`),
        illu: "empty-notes",
        primary: noEntitiesAction[config.scope],
        title: t(`${config.scope}.noEntities.title`),
      }
    : {
        desc: t(`${config.scope}.empty.description`),
        illu: "empty-notes",
        primary: { icon: "plus", label: t("empty.cta") },
        title: t(`${config.scope}.empty.title`),
      };

  function addFromEmptyLibrary() {
    if (hasNoEntities) {
      router.push(NOTES_ENTITY_START_HREF[config.scope]);
      return;
    }
    setCreateOpen(true);
  }

  function retryArchive() {
    if (notes.isLoadingError) void notes.refetch();
    if (entityPresence.kind === "error") entityPresence.retry();
  }

  const mobileOverview =
    summary.isLoadingError && contextualOverview === null ? null : (
      <NotesOverviewPanel
        isLoading={summary.isPending || overview.isPending}
        overview={contextualOverview}
        postFinishReview={postFinishReview}
        recordImpression={recordImpression}
        summaryCards={summary.isLoadingError ? null : summaryCards}
      />
    );

  return (
    <NotesArchivePageShell
      archive={
        <NotesArchiveContent
          emptyCopy={{ library: libraryEmptyState }}
          onAddNote={addFromEmptyLibrary}
          onClearFilters={query.clearAll}
          onLoadMore={() => void notes.fetchNextPage()}
          onRetry={withRetryFocus(retryArchive)}
          retryButtonRef={retryButtonRef}
          state={archiveState}
          view={query.state.view}
        />
      }
      archiveRef={archiveRef}
      contextual={contextualColumn()}
      createAction={
        chrome.showTools ? (
          <Button className="self-start sm:self-auto" onClick={() => setCreateOpen(true)}>
            <UiIcon name="plus" size={16} />
            {t("addNote")}
          </Button>
        ) : null
      }
      dialogs={
        <NoteFormDialog
          onOpenChange={setCreateOpen}
          open={isCreateOpen}
          target={{ entityType: config.entityType, mode: "pick" }}
        />
      }
      resultsHeadingRef={resultsHeadingRef}
      resultsTitle={t("resultsTitle")}
      subtitle={t(`${config.scope}.subtitle`)}
      summary={
        chrome.showMetrics ? (
          <NotesSummaryCards
            cards={summaryCards}
            isError={summary.isLoadingError}
            isLoading={summary.isPending}
            mobileAction={mobileOverview}
            onRetry={() => void summary.refetch()}
          />
        ) : null
      }
      title={t(`${config.scope}.title`)}
      toolbar={archiveToolbar()}
    />
  );

  function archiveToolbar() {
    if (!chrome.showTools) return null;
    if (notes.isPending) return <NotesArchiveToolbarSkeleton />;
    return (
      <NotesArchiveToolbar
        counter={archiveCounter()}
        facets={facets.data}
        facetsPending={facets.isPending}
        query={query}
      />
    );
  }

  function archiveCounter(): Nullable<string> {
    if (listState.kind !== "ready") return null;
    if (listState.isRefreshing) return tCommon("updating");
    const total = notes.data?.pages[0]?.totalCount ?? listState.notes.length;
    return t("counter", { shown: listState.notes.length, total });
  }

  function contextualColumn(): NotesContextualColumn {
    if (!isWideViewport || !chrome.showMetrics) return { kind: "hidden" };
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
  const seriesPresence = useSeriesPresence();
  return <NotesArchive entityPresence={seriesPresence} query={query} />;
}

function withEntityPresence({
  listState,
  presence,
}: {
  listState: NotesArchiveListState;
  presence: LibraryPresence;
}): NotesArchiveListState {
  if (listState.kind !== "empty" || listState.reason !== "library") return listState;

  switch (presence.kind) {
    case "error":
      return { kind: "error" };
    case "pending":
      return { kind: "loading" };
    case "ready":
      return listState;
    default:
      return assertNever(presence);
  }
}
