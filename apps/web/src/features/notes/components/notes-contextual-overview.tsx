"use client";

import type { NoteMemoryView } from "@app/shared";

import { useTranslations } from "next-intl";

import type { OpenNoteFullView } from "../hooks/use-note-full-view";
import type { RecordNoteImpression } from "../hooks/use-note-rediscovery-impression";
import type { PostFinishReview } from "../hooks/use-post-finish-review";
import type { NotesOverview } from "../model/notes-overview";

import { assertNever } from "../model/assert-never";
import { bookPreviewFromMemorySource } from "../model/note-entity";
import { BookNoteEntityHeader } from "./book-note-entity-header";
import { NoteMemoryCard } from "./note-memory-card";
import { NoteMemorySourceLabel } from "./note-source-label";
import { PostFinishNotesBlock } from "./post-finish-notes-block";
import { SeriesBeforeContinuationBlock } from "./series-before-continuation-block";

type NotesContextualOverviewProps = {
  onOpenNote: OpenNoteFullView;
  overview: NotesOverview;
  postFinishReview: PostFinishReview;
  recordImpression: RecordNoteImpression;
  runAction?: (action: () => void) => void;
};

export function NotesContextualOverview({
  onOpenNote,
  overview,
  postFinishReview,
  recordImpression,
  runAction = (action) => action(),
}: NotesContextualOverviewProps) {
  const t = useTranslations("notes.overview.memory");

  switch (overview.scope) {
    case "books":
      return (
        <>
          {overview.memoryNote === null ? null : (
            <NoteMemoryCard
              ctaLabel={t("showFull")}
              memory={overview.memoryNote}
              onOpenNote={onOpenNote}
              recordImpression={recordImpression}
              source={<BooksMemorySource source={overview.memoryNote.source} />}
            />
          )}
          {overview.postFinish === null ? null : (
            <PostFinishNotesBlock
              postFinish={overview.postFinish}
              review={postFinishReview}
              runAction={runAction}
            />
          )}
        </>
      );
    case "series":
      return (
        <>
          {overview.beforeNextBook === null ? null : (
            <SeriesBeforeContinuationBlock
              beforeNextBook={overview.beforeNextBook}
              onOpenNote={onOpenNote}
            />
          )}
          {overview.memoryNote === null ? null : (
            <NoteMemoryCard
              ctaLabel={t("openNote")}
              memory={overview.memoryNote}
              onOpenNote={onOpenNote}
              recordImpression={recordImpression}
              source={<NoteMemorySourceLabel source={overview.memoryNote.source} />}
            />
          )}
        </>
      );
    default:
      return assertNever(overview);
  }
}

function BooksMemorySource({ source }: { source: NoteMemoryView["source"] }) {
  if (source.type === "series") return <NoteMemorySourceLabel source={source} />;

  return <BookNoteEntityHeader book={bookPreviewFromMemorySource(source)} placement="card" />;
}
