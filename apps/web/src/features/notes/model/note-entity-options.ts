import type { BookView, NoteBookPreview, SeriesView } from "@app/shared";

import type { BookSelectOption } from "@/features/books/model/book-select-option";

import { toSeriesSelectOption } from "@/features/series/model/series-select-option";

import type { NoteEntityRef } from "./note-entity";

export function bookSelectOptionFromPreview(book: NoteBookPreview): BookSelectOption {
  return {
    authorName: book.author ?? "",
    cover: book.cover,
    id: book.id,
    title: book.title,
  };
}

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
  return { series: toSeriesSelectOption(series), type: "series" };
}
