"use client";

import type { Nullable } from "@app/shared";

import { useTranslations } from "next-intl";
import { useState } from "react";

import type { EmptyStateEntry } from "@/lib/empty-states";

import { EmptyState } from "@/components/empty-state";
import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { assertNever } from "@/lib/assert-never";
import { cn } from "@/lib/utils";

import type {
  NotesArchiveEmptyReason,
  NotesArchiveListState,
  NotesNextPageState,
} from "../model/notes-archive-list-state";
import type { NotesViewMode } from "../model/notes-archive-query";

import { NoteArchiveCard } from "./note-archive-card";
import { NoteCardSkeleton } from "./note-card-skeleton";
import { NotesErrorState } from "./notes-error-state";

const NOTES_ARCHIVE_LIST = {
  firstCardControl: "a[href]:not([tabindex='-1']), button:not([tabindex='-1'])",
  skeletonCount: 6,
} as const;

type NotesArchiveContentProps = {
  onAddNote: () => void;
  onClearFilters: () => void;
  onLoadMore: () => void;
  onRetry: () => void;
  state: NotesArchiveListState;
  view: NotesViewMode;
};

export function NotesArchiveContent({
  onAddNote,
  onClearFilters,
  onLoadMore,
  onRetry,
  state,
  view,
}: NotesArchiveContentProps) {
  switch (state.kind) {
    case "empty":
      return (
        <NotesArchiveEmpty
          onAddNote={onAddNote}
          onClearFilters={onClearFilters}
          reason={state.reason}
        />
      );
    case "error":
      return <NotesErrorState onRetry={onRetry} />;
    case "loading":
      return <NotesArchiveSkeleton view={view} />;
    case "ready":
      return <NotesArchiveList onLoadMore={onLoadMore} state={state} view={view} />;
    default:
      return assertNever(state);
  }
}

function NotesArchiveEmpty({
  onAddNote,
  onClearFilters,
  reason,
}: {
  onAddNote: () => void;
  onClearFilters: () => void;
  reason: NotesArchiveEmptyReason;
}) {
  const t = useTranslations("notes.archive");

  if (reason === "search") {
    const emptySearch: EmptyStateEntry = {
      desc: t("emptySearch.description"),
      illu: "empty-search",
      primary: { icon: "x", label: t("emptySearch.clear") },
      title: t("emptySearch.title"),
    };
    return <EmptyState onPrimary={onClearFilters} state={emptySearch} />;
  }

  if (reason === "filters") {
    const emptyFilters: EmptyStateEntry = {
      desc: t("emptyFilters.description"),
      illu: "empty-search",
      primary: { icon: "x", label: t("emptyFilters.clear") },
      title: t("emptyFilters.title"),
    };
    return <EmptyState onPrimary={onClearFilters} state={emptyFilters} />;
  }

  const emptyArchive: EmptyStateEntry = {
    desc: t("empty.description"),
    illu: "empty-notes",
    primary: { icon: "plus", label: t("empty.cta") },
    title: t("empty.title"),
  };
  return <EmptyState onPrimary={onAddNote} state={emptyArchive} />;
}

function NotesArchiveList({
  onLoadMore,
  state,
  view,
}: {
  onLoadMore: () => void;
  state: Extract<NotesArchiveListState, { kind: "ready" }>;
  view: NotesViewMode;
}) {
  const [firstNewNoteIndex, setFirstNewNoteIndex] = useState<Nullable<number>>(null);

  function loadMore() {
    setFirstNewNoteIndex(state.notes.length);
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
            key={note.id}
            ref={index === firstNewNoteIndex ? focusFirstNewNote : undefined}
          >
            <NoteArchiveCard layout={view} note={note} />
          </li>
        ))}
      </ul>

      <NotesLoadMore onLoadMore={loadMore} state={state.nextPage} />
    </div>
  );
}

function NotesArchiveSkeleton({ view }: { view: NotesViewMode }) {
  const t = useTranslations("notes.states");

  return (
    <div aria-busy aria-label={t("loading")} className={notesGridClassName(view)}>
      {Array.from({ length: NOTES_ARCHIVE_LIST.skeletonCount }, (_, index) => (
        <NoteCardSkeleton key={index} />
      ))}
    </div>
  );
}

function notesGridClassName(view: NotesViewMode): string {
  return cn("grid grid-cols-1 gap-4", view === "grid" && "lg:grid-cols-2");
}

function NotesLoadMore({
  onLoadMore,
  state,
}: {
  onLoadMore: () => void;
  state: NotesNextPageState;
}) {
  const t = useTranslations("notes.archive");
  const tCommon = useTranslations("common");

  switch (state) {
    case "error":
      return (
        <div
          className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-4 text-center"
          role="alert"
        >
          <p className="text-sm text-muted-foreground">{t("loadMoreError")}</p>
          <Button onClick={onLoadMore} size="sm" variant="secondary">
            <UiIcon name="refresh" size={14} />
            {tCommon("retry")}
          </Button>
        </div>
      );
    case "idle":
    case "loading":
      return (
        <div className="flex justify-center">
          <Button
            disabled={state === "loading"}
            loading={state === "loading"}
            onClick={onLoadMore}
            variant="secondary"
          >
            {t("loadMore")}
          </Button>
        </div>
      );
    case "none":
      return null;
    default:
      return assertNever(state);
  }
}
