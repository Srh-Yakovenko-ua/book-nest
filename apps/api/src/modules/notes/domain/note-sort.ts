import type { NoteSort } from "@app/shared";

import type { Prisma } from "../../../generated/prisma/client.js";

const ID_TIEBREAKER: Prisma.NoteOrderByWithRelationInput = { id: "asc" };
const PINNED_FIRST: Prisma.NoteOrderByWithRelationInput = { isPinned: "desc" };
const NEWEST: Prisma.NoteOrderByWithRelationInput = { createdAt: "desc" };

const SORT_ORDER_BY: Record<NoteSort, Prisma.NoteOrderByWithRelationInput[]> = {
  author: [{ book: { firstAuthorName: "asc" } }, NEWEST],
  category: [{ category: { nulls: "last", sort: "asc" } }, NEWEST],
  favorite_first: [{ isFavorite: "desc" }, NEWEST],
  newest: [NEWEST],
  no_spoiler_first: [{ isSpoiler: "asc" }, NEWEST],
  oldest: [{ createdAt: "asc" }],
  page: [{ page: { nulls: "last", sort: "asc" } }, NEWEST],
  pinned_first: [NEWEST],
  recently_updated: [{ updatedAt: "desc" }, NEWEST],
  title: [{ book: { title: "asc" } }, { series: { name: "asc" } }, NEWEST],
  with_spoiler_first: [{ isSpoiler: "desc" }, NEWEST],
};

export const BOOK_NOTES_ORDER_BY: Prisma.NoteOrderByWithRelationInput[] = [
  PINNED_FIRST,
  { page: { nulls: "last", sort: "asc" } },
  NEWEST,
  ID_TIEBREAKER,
];

export const SERIES_NOTES_ORDER_BY: Prisma.NoteOrderByWithRelationInput[] = [
  PINNED_FIRST,
  { updatedAt: "desc" },
  NEWEST,
  ID_TIEBREAKER,
];

export function notesListOrderBy(sort: NoteSort): Prisma.NoteOrderByWithRelationInput[] {
  return [PINNED_FIRST, ...SORT_ORDER_BY[sort], ID_TIEBREAKER];
}
