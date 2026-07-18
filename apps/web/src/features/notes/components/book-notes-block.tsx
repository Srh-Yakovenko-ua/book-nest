"use client";

import type { BookView } from "@app/shared";

import type { NoteEntityRef } from "../model/note-entity";

import { useBookNotes } from "../api/use-book-notes";
import { EntityNotesBlock } from "./entity-notes-block";

type BookNotesBlockProps = {
  book: BookView;
};

export function BookNotesBlock({ book }: BookNotesBlockProps) {
  const notesQuery = useBookNotes(book.id);

  const entity: NoteEntityRef = {
    book: {
      author: book.authors[0]?.name ?? null,
      cover: book.cover ?? null,
      id: book.id,
      title: book.title,
    },
    type: "book",
  };

  return (
    <EntityNotesBlock
      entity={entity}
      isError={notesQuery.isError}
      isPending={notesQuery.isPending}
      notes={notesQuery.data?.notes ?? []}
      onRetry={() => void notesQuery.refetch()}
      totalCount={notesQuery.data?.totalCount ?? 0}
    />
  );
}
