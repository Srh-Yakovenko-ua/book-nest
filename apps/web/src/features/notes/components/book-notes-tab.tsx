"use client";

import type { BookView } from "@app/shared";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import type { InfiniteScrollState } from "@/hooks/use-infinite-scroll-sentinel";

import type { NoteEntityRef } from "../model/note-entity";
import type { NotesArchiveListState } from "../model/notes-archive-list-state";
import type { BookNotesScrollMemory } from "../model/use-book-notes-scroll-anchor";
import type { UseBookNotesTabQueryResult } from "../model/use-book-notes-tab-query";

import { useNotesArchiveList } from "../api/use-notes-archive-list";
import { useNotesFacets } from "../api/use-notes-facets";
import { notesArchiveListState } from "../model/notes-archive-list-state";
import { useBookNotesEmptyCopy } from "../model/use-book-notes-empty-copy";
import { useBookNotesScrollAnchor } from "../model/use-book-notes-scroll-anchor";
import { useBookNotesTabQuery } from "../model/use-book-notes-tab-query";
import { BookNotesResultsStatus } from "./book-notes-results-status";
import { BookNotesToolbar } from "./book-notes-toolbar";
import { NoteFormDialog } from "./note-form-dialog";
import { NotesArchiveContent } from "./notes-archive-content";

type BookNotesList = ReturnType<typeof useNotesArchiveList>;

type BookNotesListStateInput = {
  notes: BookNotesList;
  query: Pick<UseBookNotesTabQueryResult, "hasActiveFilters" | "hasActiveSearch">;
};

type BookNotesTabProps = {
  book: BookView;
  scrollMemory: BookNotesScrollMemory;
};

export function BookNotesTab({ book, scrollMemory }: BookNotesTabProps) {
  const t = useTranslations("notes.bookTab");
  const query = useBookNotesTabQuery(book.id);
  const notes = useNotesArchiveList(query.listParams);
  const facets = useNotesFacets("books", query.facetsParams);
  const emptyCopy = useBookNotesEmptyCopy();
  const [isCreateOpen, setCreateOpen] = useState(false);
  const resultsStartRef = useRef<HTMLDivElement>(null);
  const criteriaKey = JSON.stringify(query.listParams);
  const previousCriteriaKey = useRef(criteriaKey);

  const listState = bookNotesListState({ notes, query });
  const isEmptyBook = listState.kind === "empty" && listState.reason === "library";
  const hasCriteria = query.hasActiveSearch || query.hasActiveFilters;
  const showToolbar = !isEmptyBook && (notes.data !== undefined || hasCriteria);

  useBookNotesScrollAnchor({
    bookId: book.id,
    containerRef: resultsStartRef,
    criteriaKey,
    isListRendered: listState.kind === "ready",
    memory: scrollMemory,
  });

  const entity: NoteEntityRef = {
    book: {
      author: book.authors[0]?.name ?? null,
      cover: book.cover ?? null,
      id: book.id,
      title: book.title,
    },
    type: "book",
  };

  useEffect(() => {
    if (previousCriteriaKey.current === criteriaKey) return;
    previousCriteriaKey.current = criteriaKey;
    const resultsStart = resultsStartRef.current;
    if (resultsStart !== null && isAboveScrollMargin(resultsStart)) {
      resultsStart.scrollIntoView({ block: "start" });
    }
  }, [criteriaKey]);

  return (
    <div
      className="flex scroll-mt-[calc(var(--shell-header-height)+1rem)] flex-col gap-5"
      ref={resultsStartRef}
    >
      <h2 className="sr-only">{t("tab")}</h2>
      <BookNotesResultsStatus
        state={listState}
        totalCount={notes.data?.pages[0]?.totalCount ?? 0}
      />
      {showToolbar ? (
        <BookNotesToolbar
          facets={facets.data}
          facetsPending={facets.isPending}
          onAddNote={() => setCreateOpen(true)}
          query={query}
        />
      ) : null}

      <NotesArchiveContent
        emptyCopy={emptyCopy}
        loadMoreFocus="none"
        onAddNote={() => setCreateOpen(true)}
        onClearFilters={query.clearFilters}
        onClearSearch={query.clearSearch}
        onLoadMore={() => void notes.fetchNextPage()}
        onRetry={() => void notes.refetch()}
        state={listState}
        view="embedded"
      />

      <NoteFormDialog
        onOpenChange={setCreateOpen}
        open={isCreateOpen}
        target={{ entity, mode: "preselected" }}
      />
    </div>
  );
}

function bookNotesListState({ notes, query }: BookNotesListStateInput): NotesArchiveListState {
  if (notes.isPlaceholderData) return { kind: "loading" };

  const state = notesArchiveListState({
    hasActiveFilters: query.hasActiveFilters,
    hasActiveSearch: query.hasActiveSearch,
    list: notes,
  });

  return state.kind === "ready" ? { ...state, nextPage: toLoadMoreState(notes) } : state;
}

function isAboveScrollMargin(element: HTMLElement): boolean {
  const scrollMargin = Number.parseFloat(getComputedStyle(element).scrollMarginTop) || 0;
  return element.getBoundingClientRect().top < scrollMargin;
}

function toLoadMoreState(notes: BookNotesList): InfiniteScrollState {
  if (notes.isFetchingNextPage) return "loading";
  if (notes.isFetchNextPageError) return "error";
  if (!notes.hasNextPage) return "none";
  return notes.isFetching ? "loading" : "idle";
}
