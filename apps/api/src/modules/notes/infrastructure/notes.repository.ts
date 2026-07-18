import type {
  NoteCategory,
  NoteEntityFilter,
  NoteEntityType,
  NoteFilter,
  NoteSort,
  Nullable,
} from "@app/shared";

import { NOTE_PAGE_MAX } from "@app/shared";
import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import {
  BOOK_NOTES_ORDER_BY,
  notesListOrderBy,
  SERIES_NOTES_ORDER_BY,
} from "../domain/note-sort.js";
import { type NoteSummaryCounts } from "../domain/note-summary.js";

const noteEntityArgs = {
  include: {
    book: { select: { coverMedia: true, firstAuthorName: true, id: true, title: true } },
    series: {
      select: {
        _count: { select: { books: true } },
        authors: {
          orderBy: { author: { name: "asc" } },
          select: { author: { select: { name: true } } },
        },
        books: {
          orderBy: [{ partNumber: "asc" }, { createdAt: "asc" }],
          select: { coverMedia: true },
          take: 1,
          where: { coverMediaId: { not: null } },
        },
        id: true,
        name: true,
      },
    },
  },
} satisfies Prisma.NoteDefaultArgs;

export type CreateNoteData = {
  bookId: Nullable<string>;
  category: Nullable<string>;
  chapter: Nullable<string>;
  customCategory: Nullable<string>;
  entityType: NoteEntityType;
  isFavorite: boolean;
  isPinned: boolean;
  isSpoiler: boolean;
  page: Nullable<number>;
  seriesId: Nullable<string>;
  text: string;
  userId: string;
};

export type NotesFilterInput = {
  bookId: string | undefined;
  category: NoteCategory | undefined;
  customCategory: string | undefined;
  entityType: NoteEntityFilter;
  filter: NoteFilter;
  hasChapter: boolean | undefined;
  hasPage: boolean | undefined;
  search: string | undefined;
  seriesId: string | undefined;
  userId: string;
};

export type NoteWithEntity = Prisma.NoteGetPayload<typeof noteEntityArgs>;

export type UpdateNoteArgs = {
  fields: UpdateNoteFields;
  noteId: string;
  userId: string;
};

export type UpdateNoteFields = {
  category?: Nullable<string>;
  chapter?: Nullable<string>;
  customCategory?: Nullable<string>;
  isFavorite?: boolean;
  isPinned?: boolean;
  isSpoiler?: boolean;
  page?: Nullable<number>;
  text?: string;
};

type ListNotesInput = NotesFilterInput & {
  skip: number;
  sort: NoteSort;
  take: number;
};

@Injectable()
export class NotesRepository {
  constructor(private readonly prisma: PrismaService) {}

  countNotes(filter: NotesFilterInput): Promise<number> {
    return this.prisma.note.count({ where: buildNotesWhere(filter) });
  }

  create(data: CreateNoteData): Promise<NoteWithEntity> {
    return this.prisma.note.create({ data, ...noteEntityArgs });
  }

  async deleteOwned(userId: string, noteId: string): Promise<number> {
    const result = await this.prisma.note.deleteMany({ where: { id: noteId, userId } });
    return result.count;
  }

  findOwnedById(userId: string, noteId: string): Promise<Nullable<NoteWithEntity>> {
    return this.prisma.note.findFirst({ where: { id: noteId, userId }, ...noteEntityArgs });
  }

  listByBook(userId: string, bookId: string): Promise<NoteWithEntity[]> {
    return this.prisma.note.findMany({
      orderBy: BOOK_NOTES_ORDER_BY,
      where: { bookId, userId },
      ...noteEntityArgs,
    });
  }

  listBySeries(userId: string, seriesId: string): Promise<NoteWithEntity[]> {
    return this.prisma.note.findMany({
      orderBy: SERIES_NOTES_ORDER_BY,
      where: { seriesId, userId },
      ...noteEntityArgs,
    });
  }

  listNotes({ skip, sort, take, ...filter }: ListNotesInput): Promise<NoteWithEntity[]> {
    return this.prisma.note.findMany({
      orderBy: notesListOrderBy(sort),
      skip,
      take,
      where: buildNotesWhere(filter),
      ...noteEntityArgs,
    });
  }

  async summaryCounts(userId: string): Promise<NoteSummaryCounts> {
    const base: Prisma.NoteWhereInput = { userId };

    const [
      total,
      bookNotesCount,
      withSpoilerCount,
      favoriteCount,
      pinnedCount,
      bookGroups,
      seriesGroups,
      customCategoryRows,
    ] = await Promise.all([
      this.prisma.note.count({ where: base }),
      this.prisma.note.count({ where: { ...base, entityType: "book" } }),
      this.prisma.note.count({ where: { ...base, isSpoiler: true } }),
      this.prisma.note.count({ where: { ...base, isFavorite: true } }),
      this.prisma.note.count({ where: { ...base, isPinned: true } }),
      this.prisma.note.groupBy({ by: ["bookId"], where: { ...base, bookId: { not: null } } }),
      this.prisma.note.groupBy({ by: ["seriesId"], where: { ...base, seriesId: { not: null } } }),
      this.prisma.note.findMany({
        distinct: ["customCategory"],
        orderBy: { customCategory: "asc" },
        select: { customCategory: true },
        where: { ...base, customCategory: { not: null } },
      }),
    ]);

    return {
      availableCustomCategories: customCategoryRows
        .map((row) => row.customCategory)
        .filter((value): value is string => value !== null),
      bookNotesCount,
      booksWithNotesCount: bookGroups.length,
      favoriteCount,
      pinnedCount,
      seriesWithNotesCount: seriesGroups.length,
      total,
      withSpoilerCount,
    };
  }

  update({ fields, noteId, userId }: UpdateNoteArgs): Promise<NoteWithEntity> {
    return this.prisma.note.update({
      data: fields,
      where: { id: noteId, userId },
      ...noteEntityArgs,
    });
  }
}

function applyNoteFilter(filter: NoteFilter, where: Prisma.NoteWhereInput): void {
  switch (filter) {
    case "all":
      return;
    case "favorite":
      where.isFavorite = true;
      return;
    case "no_spoiler":
      where.isSpoiler = false;
      return;
    case "pinned":
      where.isPinned = true;
      return;
    case "with_spoiler":
      where.isSpoiler = true;
      return;
    default: {
      const _exhaustiveCheck: never = filter;
      return _exhaustiveCheck;
    }
  }
}

function buildNoteSearchConditions(search: string): Prisma.NoteWhereInput[] {
  const contains = { contains: search, mode: "insensitive" } as const;
  const conditions: Prisma.NoteWhereInput[] = [
    { text: contains },
    { book: { firstAuthorName: contains } },
    { book: { originalTitle: contains } },
    { book: { title: contains } },
    { category: contains },
    { chapter: contains },
    { customCategory: contains },
    { series: { name: contains } },
  ];

  const parsedPage = Number.parseInt(search, 10);
  if (
    Number.isInteger(parsedPage) &&
    parsedPage > 0 &&
    parsedPage <= NOTE_PAGE_MAX &&
    String(parsedPage) === search
  ) {
    conditions.push({ page: parsedPage });
  }

  return conditions;
}

function buildNotesWhere({
  bookId,
  category,
  customCategory,
  entityType,
  filter,
  hasChapter,
  hasPage,
  search,
  seriesId,
  userId,
}: NotesFilterInput): Prisma.NoteWhereInput {
  const where: Prisma.NoteWhereInput = { userId };

  if (entityType !== "all") {
    where.entityType = entityType;
  }
  if (category !== undefined) {
    where.category = category;
  }
  if (customCategory !== undefined) {
    where.customCategory = customCategory;
  }
  if (bookId !== undefined) {
    where.bookId = bookId;
  }
  if (seriesId !== undefined) {
    where.seriesId = seriesId;
  }

  if (hasPage !== undefined) {
    where.page = hasPage ? { not: null } : null;
  }
  if (hasChapter !== undefined) {
    where.chapter = hasChapter ? { not: null } : null;
  }

  applyNoteFilter(filter, where);

  if (search !== undefined) {
    where.OR = buildNoteSearchConditions(search);
  }

  return where;
}
