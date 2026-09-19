import type { NoteCategory, NoteFilter } from "@app/shared";

import { NOTE_INPUT_LIMITS, NoteEntityTypeSchema } from "@app/shared";

import type { Prisma } from "../../../generated/prisma/client.js";

import { escapeLikePattern } from "../../../core/database/like-pattern.js";
import { SOFT_DELETE_SCOPE } from "../../../core/database/soft-delete.js";
import { buildBookTextSearchConditions } from "../../books/index.js";
import { hasValues } from "./note-archive-filters.js";
import { NOTE_QUICK_FILTER_WHERE } from "./note-quick-filter.js";

export type BookNotesDataset = {
  authorIds: string[] | undefined;
  bookIds: string[] | undefined;
  categories: NoteCategory[] | undefined;
  customCategories: string[] | undefined;
  hasChapter: boolean | undefined;
  hasPage: boolean | undefined;
  search: string | undefined;
  userId: string;
};

export function buildBookNotesWhere({
  dataset,
  quickFilter,
}: {
  dataset: BookNotesDataset;
  quickFilter: NoteFilter;
}): Prisma.NoteWhereInput {
  return { AND: [buildBookNotesDatasetWhere(dataset), NOTE_QUICK_FILTER_WHERE[quickFilter]] };
}

function buildBookNotesDatasetWhere({
  authorIds,
  bookIds,
  categories,
  customCategories,
  hasChapter,
  hasPage,
  search,
  userId,
}: BookNotesDataset): Prisma.NoteWhereInput {
  const conditions: Prisma.NoteWhereInput[] = [
    {
      ...SOFT_DELETE_SCOPE.active,
      book: SOFT_DELETE_SCOPE.active,
      entityType: NoteEntityTypeSchema.enum.book,
      userId,
    },
  ];

  if (hasValues(bookIds)) {
    conditions.push({ bookId: { in: bookIds } });
  }
  if (hasValues(authorIds)) {
    conditions.push({ book: { authors: { some: { authorId: { in: authorIds } } } } });
  }

  const categoryDimension = buildNoteCategoryDimension({ categories, customCategories });
  if (categoryDimension !== undefined) {
    conditions.push(categoryDimension);
  }

  if (hasPage !== undefined) {
    conditions.push({ page: hasPage ? { not: null } : null });
  }
  if (hasChapter !== undefined) {
    conditions.push({ chapter: hasChapter ? { not: null } : null });
  }

  if (search !== undefined) {
    conditions.push({ OR: buildBookNoteSearchConditions(search) });
  }

  return { AND: conditions };
}

function buildBookNoteSearchConditions(search: string): Prisma.NoteWhereInput[] {
  const contains = { contains: escapeLikePattern(search), mode: "insensitive" } as const;
  const conditions: Prisma.NoteWhereInput[] = [
    { text: contains },
    ...buildBookTextSearchConditions(search).map((condition) => ({ book: condition })),
    { chapter: contains },
    { customCategory: contains },
  ];

  const exactPage = parseExactPageSearch(search);
  if (exactPage !== undefined) {
    conditions.push({ page: exactPage });
  }

  return conditions;
}

function buildNoteCategoryDimension({
  categories,
  customCategories,
}: {
  categories: NoteCategory[] | undefined;
  customCategories: string[] | undefined;
}): Prisma.NoteWhereInput | undefined {
  const alternatives: Prisma.NoteWhereInput[] = [];
  if (hasValues(categories)) {
    alternatives.push({ category: { in: categories } });
  }
  if (hasValues(customCategories)) {
    alternatives.push({ customCategory: { in: customCategories } });
  }
  return alternatives.length === 0 ? undefined : { OR: alternatives };
}

function parseExactPageSearch(search: string): number | undefined {
  const parsedPage = Number.parseInt(search, 10);
  const isExactPositivePage =
    Number.isInteger(parsedPage) &&
    parsedPage > 0 &&
    parsedPage <= NOTE_INPUT_LIMITS.pageMax &&
    String(parsedPage) === search;
  return isExactPositivePage ? parsedPage : undefined;
}
