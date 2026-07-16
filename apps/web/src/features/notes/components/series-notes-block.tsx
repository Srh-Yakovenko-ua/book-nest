"use client";

import type { MediaView, Nullable, SeriesBookView, SeriesDetailsView } from "@app/shared";

import type { NoteEntityRef } from "../model/note-entity";

import { useSeriesNotes } from "../api/use-series-notes";
import { EntityNotesBlock } from "./entity-notes-block";

type SeriesNotesBlockProps = {
  details: SeriesDetailsView;
};

export function SeriesNotesBlock({ details }: SeriesNotesBlockProps) {
  const notesQuery = useSeriesNotes(details.id);

  const entity: NoteEntityRef = {
    series: {
      authors: details.authors.map((author) => author.name),
      booksCount: details.booksInSeries,
      cover: seriesCover(details.books),
      id: details.id,
      name: details.name,
    },
    type: "series",
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

function byReadingOrder(left: SeriesBookView, right: SeriesBookView): number {
  if (left.partNumber === null) return right.partNumber === null ? 0 : 1;
  if (right.partNumber === null) return -1;
  if (left.partNumber !== right.partNumber) return left.partNumber - right.partNumber;
  return left.createdAt.localeCompare(right.createdAt);
}

function seriesCover(books: SeriesBookView[]): Nullable<MediaView> {
  const firstCovered = [...books]
    .sort(byReadingOrder)
    .find((book) => book.cover !== null && book.cover !== undefined);

  return firstCovered?.cover ?? null;
}
