"use client";

import type { NoteView } from "@app/shared";

import { useTranslations } from "next-intl";

import type { EmptyStateEntry } from "@/lib/empty-states";

import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";

import { NoteCard } from "./note-card";
import { NoteCardSkeleton } from "./note-card-skeleton";
import { NotesErrorState } from "./notes-error-state";

const SKELETON_COUNT = 6;

type NotesArchiveContentProps = {
  hasActiveFilters: boolean;
  hasActiveSearch: boolean;
  hasAnyNotes: boolean;
  hasNextPage: boolean;
  isError: boolean;
  isFetchingNextPage: boolean;
  isPending: boolean;
  notes: NoteView[];
  onAddNote: () => void;
  onClearFilters: () => void;
  onLoadMore: () => void;
  onRetry: () => void;
};

export function NotesArchiveContent({
  hasActiveFilters,
  hasActiveSearch,
  hasAnyNotes,
  hasNextPage,
  isError,
  isFetchingNextPage,
  isPending,
  notes,
  onAddNote,
  onClearFilters,
  onLoadMore,
  onRetry,
}: NotesArchiveContentProps) {
  const t = useTranslations("notes.archive");

  if (isError) return <NotesErrorState onRetry={onRetry} />;

  if (isPending) return <NotesArchiveSkeleton />;

  if (notes.length === 0) {
    return (
      <NotesArchiveEmpty
        hasActiveFilters={hasActiveFilters}
        hasActiveSearch={hasActiveSearch}
        hasAnyNotes={hasAnyNotes}
        onAddNote={onAddNote}
        onClearFilters={onClearFilters}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {notes.map((note) => (
          <li className="flex flex-col" key={note.id}>
            <NoteCard note={note} showEntity />
          </li>
        ))}
      </ul>

      {hasNextPage ? (
        <div className="flex justify-center">
          <Button
            disabled={isFetchingNextPage}
            loading={isFetchingNextPage}
            onClick={onLoadMore}
            variant="secondary"
          >
            {t("loadMore")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function NotesArchiveEmpty({
  hasActiveFilters,
  hasActiveSearch,
  hasAnyNotes,
  onAddNote,
  onClearFilters,
}: {
  hasActiveFilters: boolean;
  hasActiveSearch: boolean;
  hasAnyNotes: boolean;
  onAddNote: () => void;
  onClearFilters: () => void;
}) {
  const t = useTranslations("notes.archive");

  if (hasAnyNotes && hasActiveSearch) {
    const emptySearch: EmptyStateEntry = {
      desc: t("emptySearch.description"),
      illu: "empty-search",
      primary: { icon: "x", label: t("emptySearch.clear") },
      title: t("emptySearch.title"),
    };
    return <EmptyState onPrimary={onClearFilters} state={emptySearch} />;
  }

  if (hasAnyNotes && hasActiveFilters) {
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

function NotesArchiveSkeleton() {
  const t = useTranslations("notes.states");

  return (
    <div aria-busy aria-label={t("loading")} className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {Array.from({ length: SKELETON_COUNT }, (_, index) => (
        <NoteCardSkeleton key={index} />
      ))}
    </div>
  );
}
