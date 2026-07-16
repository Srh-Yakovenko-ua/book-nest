import type { MediaView, NoteView, Nullable } from "@app/shared";

import { NoteCategorySchema, NoteEntityTypeSchema } from "@app/shared";

export type NoteEntityCovers = {
  book: Nullable<MediaView>;
  series: Nullable<MediaView>;
};

type NoteMapperSource = {
  book: Nullable<{ id: string; title: string }>;
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
  series: Nullable<{ id: string; name: string }>;
  text: string;
  updatedAt: Date;
};

export function toNoteView(note: NoteMapperSource, covers: NoteEntityCovers): NoteView {
  return {
    book:
      note.book === null ? null : { cover: covers.book, id: note.book.id, title: note.book.title },
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
        : { cover: covers.series, id: note.series.id, name: note.series.name },
    text: note.text,
    updatedAt: note.updatedAt.toISOString(),
  };
}
