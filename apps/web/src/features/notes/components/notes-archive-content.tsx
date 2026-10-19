"use client";

import type { Nullable } from "@app/shared";

import { useTranslations } from "next-intl";
import { useState } from "react";

import type { EmptyStateEntry } from "@/lib/empty-states";

import { EmptyState } from "@/components/empty-state";
import { InfiniteScrollFooter } from "@/components/infinite-scroll-footer";
import { assertNever } from "@/lib/assert-never";
import { cn } from "@/lib/utils";

import type {
  NotesArchiveEmptyCopy,
  NotesArchiveEmptyReason,
  NotesArchiveListState,
} from "../model/notes-archive-list-state";
import type { NoteCardLayout } from "./note-card-layout";

import { NoteArchiveCard } from "./note-archive-card";
import { NoteCardSkeleton } from "./note-card-skeleton";
import { NotesErrorState } from "./notes-error-state";

const NOTES_ARCHIVE_LIST = {
  firstCardControl: "a[href]:not([tabindex='-1']), button:not([tabindex='-1'])",
  skeletonCount: 6,
} as const;

type NotesArchiveContentProps = {
  emptyCopy?: NotesArchiveEmptyCopy;
  loadMoreFocus?: NotesArchiveLoadMoreFocus;
  onAddNote: () => void;
  onClearFilters: () => void;
  onClearSearch?: () => void;
  onLoadMore: () => void;
  onRetry: () => void;
  state: NotesArchiveListState;
  view: NotesArchiveLayout;
};

type NotesArchiveLayout = Exclude<NoteCardLayout, "compact">;

type NotesArchiveLoadMoreFocus = "first-new-note" | "none";

export function NotesArchiveContent({
  emptyCopy,
  loadMoreFocus = "first-new-note",
  onAddNote,
  onClearFilters,
  onClearSearch = onClearFilters,
  onLoadMore,
  onRetry,
  state,
  view,
}: NotesArchiveContentProps) {
  const emptyActions = {
    filters: onClearFilters,
    library: onAddNote,
    search: onClearSearch,
  } satisfies Record<NotesArchiveEmptyReason, () => void>;

  switch (state.kind) {
    case "empty":
      return (
        <NotesArchiveEmpty
          copy={emptyCopy}
          onPrimary={emptyActions[state.reason]}
          reason={state.reason}
        />
      );
    case "error":
      return <NotesErrorState onRetry={onRetry} />;
    case "loading":
      return <NotesArchiveSkeleton view={view} />;
    case "ready":
      return (
        <NotesArchiveList
          loadMoreFocus={loadMoreFocus}
          onLoadMore={onLoadMore}
          state={state}
          view={view}
        />
      );
    default:
      return assertNever(state);
  }
}

function NotesArchiveEmpty({
  copy,
  onPrimary,
  reason,
}: {
  copy: NotesArchiveEmptyCopy | undefined;
  onPrimary: () => void;
  reason: NotesArchiveEmptyReason;
}) {
  const t = useTranslations("notes.archive");

  const archiveCopy: Record<NotesArchiveEmptyReason, EmptyStateEntry> = {
    filters: {
      desc: t("emptyFilters.description"),
      illu: "empty-search",
      primary: { icon: "x", label: t("emptyFilters.clear") },
      title: t("emptyFilters.title"),
    },
    library: {
      desc: t("empty.description"),
      illu: "empty-notes",
      primary: { icon: "plus", label: t("empty.cta") },
      title: t("empty.title"),
    },
    search: {
      desc: t("emptySearch.description"),
      illu: "empty-search",
      primary: { icon: "x", label: t("emptySearch.clear") },
      title: t("emptySearch.title"),
    },
  };

  return <EmptyState onPrimary={onPrimary} state={copy?.[reason] ?? archiveCopy[reason]} />;
}

function NotesArchiveList({
  loadMoreFocus,
  onLoadMore,
  state,
  view,
}: {
  loadMoreFocus: NotesArchiveLoadMoreFocus;
  onLoadMore: () => void;
  state: Extract<NotesArchiveListState, { kind: "ready" }>;
  view: NotesArchiveLayout;
}) {
  const t = useTranslations("notes.archive");
  const [firstNewNoteIndex, setFirstNewNoteIndex] = useState<Nullable<number>>(null);

  function loadMore() {
    const isExplicitRetry = state.nextPage === "error";
    if (loadMoreFocus === "first-new-note" || isExplicitRetry) {
      setFirstNewNoteIndex(state.notes.length);
    }
    onLoadMore();
  }

  function focusFirstNewNote(item: Nullable<HTMLLIElement>) {
    if (item === null) return;
    item.querySelector<HTMLElement>(NOTES_ARCHIVE_LIST.firstCardControl)?.focus();
    setFirstNewNoteIndex(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <ul
        aria-busy={state.isRefreshing}
        className={cn(
          notesGridClassName(view),
          "transition-opacity duration-200",
          state.isRefreshing && "opacity-60",
        )}
      >
        {state.notes.map((note, index) => (
          <li
            className="flex min-w-0 flex-col"
            data-note-id={note.id}
            key={note.id}
            ref={index === firstNewNoteIndex ? focusFirstNewNote : undefined}
          >
            <NoteArchiveCard layout={view} note={note} />
          </li>
        ))}
      </ul>

      <InfiniteScrollFooter
        errorFocus={loadMoreFocus === "none" ? "none" : "retry"}
        errorLabel={t("loadMoreError")}
        onLoadMore={loadMore}
        state={state.nextPage}
      />
    </div>
  );
}

function NotesArchiveSkeleton({ view }: { view: NotesArchiveLayout }) {
  const t = useTranslations("notes.states");

  return (
    <div aria-busy aria-label={t("loading")} className={notesGridClassName(view)}>
      {Array.from({ length: NOTES_ARCHIVE_LIST.skeletonCount }, (_, index) => (
        <NoteCardSkeleton key={index} />
      ))}
    </div>
  );
}

function notesGridClassName(view: NotesArchiveLayout): string {
  return cn("grid grid-cols-1 gap-4", view === "grid" && "lg:grid-cols-2");
}
