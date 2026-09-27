import type { NoteView } from "@app/shared";

export const NOTE_FIXTURE = {
  createdAt: "2026-01-05T10:00:00.000Z",
  text: "Пол бачить майбутнє, але не може його змінити.",
} as const;

export function makeBookNote(overrides: Partial<NoteView> = {}): NoteView {
  return {
    book: { author: "Френк Герберт", cover: null, id: "book-1", title: "Дюна" },
    category: "characters",
    chapter: null,
    createdAt: NOTE_FIXTURE.createdAt,
    customCategory: null,
    entityType: "book",
    id: "note-1",
    isFavorite: false,
    isPinned: false,
    isSpoiler: false,
    page: null,
    series: null,
    text: NOTE_FIXTURE.text,
    updatedAt: NOTE_FIXTURE.createdAt,
    ...overrides,
  };
}

export function makeSeriesNote(overrides: Partial<NoteView> = {}): NoteView {
  return makeBookNote({
    book: null,
    entityType: "series",
    series: {
      authors: ["Френк Герберт"],
      booksCount: 6,
      cover: null,
      id: "series-1",
      name: "Хроніки Дюни",
    },
    ...overrides,
  });
}
