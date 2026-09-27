import type { MediaView, NoteView, Nullable } from "@app/shared";

import { NoteCategorySchema, NoteEntityTypeSchema } from "@app/shared";

import { resolveSeriesCanonicalAuthors } from "../../series/index.js";
import { emptyToNull } from "./note-fields.js";

export type NoteEntityCovers = {
  book: Nullable<MediaView>;
  series: Nullable<MediaView>;
};

type NoteCoverSource<TAsset> = {
  book: Nullable<{ coverMedia: Nullable<TAsset> }>;
  series: Nullable<{ books: { coverMedia: Nullable<TAsset> }[] }>;
};

type NoteMapperSource = {
  book: Nullable<{ firstAuthorName: string; id: string; title: string }>;
  category: Nullable<string>;
  chapter: Nullable<string>;
  createdAt: Date;
  customCategory: Nullable<string>;
  entityType: string;
  id: string;
  isFavorite: boolean;
  isPinned: boolean;
  isSpoiler: boolean;
  page: Nullable<number>;
  series: Nullable<{
    _count: { books: number };
    authors: { author: { id: string; name: string } }[];
    books: {
      authors: { author: { id: string; name: string }; position: number }[];
      createdAt: Date;
      partNumber: Nullable<number>;
    }[];
    id: string;
    name: string;
  }>;
  text: string;
  updatedAt: Date;
};

export function resolveNoteEntityCovers<TAsset>({
  buildCover,
  note,
}: {
  buildCover: (asset: Nullable<TAsset>) => Nullable<MediaView>;
  note: NoteCoverSource<TAsset>;
}): NoteEntityCovers {
  const firstSeriesCover =
    note.series?.books.find((book) => book.coverMedia !== null)?.coverMedia ?? null;
  return {
    book: buildCover(note.book?.coverMedia ?? null),
    series: buildCover(firstSeriesCover),
  };
}

export function toNoteView(note: NoteMapperSource, covers: NoteEntityCovers): NoteView {
  return {
    book:
      note.book === null
        ? null
        : {
            author: emptyToNull(note.book.firstAuthorName),
            cover: covers.book,
            id: note.book.id,
            title: note.book.title,
          },
    category: note.category === null ? null : NoteCategorySchema.parse(note.category),
    chapter: note.chapter,
    createdAt: note.createdAt.toISOString(),
    customCategory: note.customCategory,
    entityType: NoteEntityTypeSchema.parse(note.entityType),
    id: note.id,
    isFavorite: note.isFavorite,
    isPinned: note.isPinned,
    isSpoiler: note.isSpoiler,
    page: note.page,
    series:
      note.series === null
        ? null
        : {
            authors: resolveSeriesCanonicalAuthors(note.series).map((author) => author.name),
            booksCount: note.series._count.books,
            cover: covers.series,
            id: note.series.id,
            name: note.series.name,
          },
    text: note.text,
    updatedAt: note.updatedAt.toISOString(),
  };
}
