import type { BookView, SeriesView } from "@app/shared";

import type { NoteEntityRef } from "./note-entity";

export function noteEntityRefFromBook(book: BookView): NoteEntityRef {
  return {
    book: {
      author: book.authors[0]?.name ?? null,
      cover: book.cover ?? null,
      id: book.id,
      title: book.title,
    },
    type: "book",
  };
}

export function noteEntityRefFromSeries(series: SeriesView): NoteEntityRef {
  return {
    series: {
      authors: series.authors.map((author) => author.name),
      booksCount: series.booksInSeries,
      cover: null,
      id: series.id,
      name: series.name,
    },
    type: "series",
  };
}
