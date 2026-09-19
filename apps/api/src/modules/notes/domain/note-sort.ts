import type { BookNoteSort } from "@app/shared";

import type { Prisma } from "../../../generated/prisma/client.js";

type NoteOrderBy = Prisma.NoteOrderByWithRelationInput;

const NOTE_ORDER = {
  bookAuthor: { book: { firstAuthorName: "asc" } },
  bookTitle: { book: { title: "asc" } },
  idTiebreaker: { id: "asc" },
  newest: { createdAt: "desc" },
  oldest: { createdAt: "asc" },
  page: { page: { nulls: "last", sort: "asc" } },
  pinnedFirst: { isPinned: "desc" },
  recentlyUpdated: { updatedAt: "desc" },
} as const satisfies Record<string, NoteOrderBy>;

export const BOOK_NOTE_SORT_ORDER_BY: Record<BookNoteSort, NoteOrderBy[]> = {
  author: [NOTE_ORDER.bookAuthor, NOTE_ORDER.bookTitle, NOTE_ORDER.idTiebreaker],
  newest: [NOTE_ORDER.newest, NOTE_ORDER.idTiebreaker],
  oldest: [NOTE_ORDER.oldest, NOTE_ORDER.idTiebreaker],
  page: [NOTE_ORDER.bookTitle, NOTE_ORDER.page, NOTE_ORDER.idTiebreaker],
  pinned_first: [NOTE_ORDER.pinnedFirst, NOTE_ORDER.newest, NOTE_ORDER.idTiebreaker],
  recently_updated: [NOTE_ORDER.recentlyUpdated, NOTE_ORDER.newest, NOTE_ORDER.idTiebreaker],
  title: [NOTE_ORDER.bookTitle, NOTE_ORDER.newest, NOTE_ORDER.idTiebreaker],
};

export const BOOK_NOTES_ORDER_BY: NoteOrderBy[] = [
  NOTE_ORDER.pinnedFirst,
  NOTE_ORDER.page,
  NOTE_ORDER.newest,
  NOTE_ORDER.idTiebreaker,
];

export const SERIES_NOTES_ORDER_BY: NoteOrderBy[] = [
  NOTE_ORDER.pinnedFirst,
  NOTE_ORDER.recentlyUpdated,
  NOTE_ORDER.newest,
  NOTE_ORDER.idTiebreaker,
];
