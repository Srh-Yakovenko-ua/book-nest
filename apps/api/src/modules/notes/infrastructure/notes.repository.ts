import type {
  BookNoteSort,
  NoteEntityType,
  NoteFilter,
  Nullable,
  SeriesNoteSort,
} from "@app/shared";

import { Injectable } from "@nestjs/common";
import { z } from "zod";

import type { TrashStamp } from "../../../core/trash-retention.js";
import type { Prisma } from "../../../generated/prisma/client.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { isTrashed, SOFT_DELETE_SCOPE, type Trashed } from "../../../core/database/soft-delete.js";
import {
  BOOK_NOTE_SORT_ORDER_BY,
  BOOK_NOTES_ORDER_BY,
  SERIES_NOTES_ORDER_BY,
} from "../domain/note-sort.js";
import { type BookNotesDataset, buildBookNotesWhere } from "./book-notes-where.js";
import {
  buildSeriesNotesCountQuery,
  buildSeriesNotesPageQuery,
  parseSeriesNotesTotal,
  type SeriesNotesDataset,
} from "./series-notes-sql.js";

const NOTE_ON_ACTIVE_ENTITY: Prisma.NoteWhereInput = {
  AND: [
    { OR: [{ bookId: null }, { book: SOFT_DELETE_SCOPE.active }] },
    { OR: [{ seriesId: null }, { series: SOFT_DELETE_SCOPE.active }] },
  ],
};

const noteEntityArgs = {
  include: {
    book: { select: { coverMedia: true, firstAuthorName: true, id: true, title: true } },
    series: {
      select: {
        _count: { select: { books: { where: SOFT_DELETE_SCOPE.active } } },
        authors: {
          orderBy: { author: { name: "asc" } },
          select: { author: { select: { id: true, name: true } } },
        },
        books: {
          orderBy: [{ partNumber: "asc" }, { createdAt: "asc" }, { id: "asc" }],
          select: {
            authors: {
              orderBy: { position: "asc" },
              select: { author: { select: { id: true, name: true } }, position: true },
            },
            coverMedia: true,
            createdAt: true,
            partNumber: true,
          },
          where: SOFT_DELETE_SCOPE.active,
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
  updatedAt?: Date;
};

type ArchiveCountInput<TDataset> = {
  dataset: TDataset;
  quickFilter: NoteFilter;
};

type ArchivePageInput<TSort> = {
  quickFilter: NoteFilter;
  skip: number;
  sort: TSort;
  take: number;
};

type ListBookArchiveInput = ArchivePageInput<BookNoteSort> & { dataset: BookNotesDataset };

type ListSeriesArchiveInput = ArchivePageInput<SeriesNoteSort> & { dataset: SeriesNotesDataset };

const NoteIdRowSchema = z.object({ id: z.uuid() });

const trashedNoteSelect = {
  book: { select: { title: true } },
  deletedAt: true,
  entityType: true,
  id: true,
  purgeAt: true,
  series: { select: { name: true } },
  text: true,
} satisfies Prisma.NoteSelect;

export type TrashedNoteRow = Trashed<TrashedNoteSelection>;

type TrashedNoteSelection = Prisma.NoteGetPayload<{ select: typeof trashedNoteSelect }>;

@Injectable()
export class NotesRepository {
  constructor(private readonly prisma: PrismaService) {}

  countBookArchive(selection: ArchiveCountInput<BookNotesDataset>): Promise<number> {
    return this.prisma.note.count({ where: buildBookNotesWhere(selection) });
  }

  async countSeriesArchive(selection: ArchiveCountInput<SeriesNotesDataset>): Promise<number> {
    const rows = await this.prisma.$queryRaw(buildSeriesNotesCountQuery(selection));
    return parseSeriesNotesTotal(rows);
  }

  countTrashed({ userId }: { userId: string }): Promise<number> {
    return this.prisma.note.count({
      where: { AND: [{ ...SOFT_DELETE_SCOPE.trashed, userId }, NOTE_ON_ACTIVE_ENTITY] },
    });
  }

  create(data: CreateNoteData): Promise<NoteWithEntity> {
    return this.prisma.note.create({ data, ...noteEntityArgs });
  }

  findForPurge({
    noteId,
    userId,
  }: {
    noteId: string;
    userId: string;
  }): Promise<Nullable<{ deletedAt: Nullable<Date> }>> {
    return this.prisma.note.findFirst({
      select: { deletedAt: true },
      where: { id: noteId, userId },
    });
  }

  findOwnedById(userId: string, noteId: string): Promise<Nullable<NoteWithEntity>> {
    return this.prisma.note.findFirst({
      where: { AND: [{ ...SOFT_DELETE_SCOPE.active, id: noteId, userId }, NOTE_ON_ACTIVE_ENTITY] },
      ...noteEntityArgs,
    });
  }

  findPurgeCandidates({
    limit,
    now,
  }: {
    limit: number;
    now: Date;
  }): Promise<{ id: string; userId: string }[]> {
    return this.prisma.note.findMany({
      orderBy: { purgeAt: "asc" },
      select: { id: true, userId: true },
      take: limit,
      where: SOFT_DELETE_SCOPE.overdue(now),
    });
  }

  async hardDeleteIfTrashed({
    noteId,
    now,
    userId,
  }: {
    noteId: string;
    now: Date;
    userId: string;
  }): Promise<number> {
    const purged = await this.prisma.note.deleteMany({
      where: { ...SOFT_DELETE_SCOPE.overdue(now), id: noteId, userId },
    });
    return purged.count;
  }

  listActiveByIds({
    noteIds,
    userId,
  }: {
    noteIds: string[];
    userId: string;
  }): Promise<NoteWithEntity[]> {
    return this.prisma.note.findMany({
      where: {
        AND: [{ ...SOFT_DELETE_SCOPE.active, id: { in: noteIds }, userId }, NOTE_ON_ACTIVE_ENTITY],
      },
      ...noteEntityArgs,
    });
  }

  listBookArchive({
    dataset,
    quickFilter,
    skip,
    sort,
    take,
  }: ListBookArchiveInput): Promise<NoteWithEntity[]> {
    return this.prisma.note.findMany({
      orderBy: BOOK_NOTE_SORT_ORDER_BY[sort],
      skip,
      take,
      where: buildBookNotesWhere({ dataset, quickFilter }),
      ...noteEntityArgs,
    });
  }

  listByBook(userId: string, bookId: string): Promise<NoteWithEntity[]> {
    return this.prisma.note.findMany({
      orderBy: BOOK_NOTES_ORDER_BY,
      where: { ...SOFT_DELETE_SCOPE.active, book: SOFT_DELETE_SCOPE.active, bookId, userId },
      ...noteEntityArgs,
    });
  }

  listBySeries(userId: string, seriesId: string): Promise<NoteWithEntity[]> {
    return this.prisma.note.findMany({
      orderBy: SERIES_NOTES_ORDER_BY,
      where: { ...SOFT_DELETE_SCOPE.active, series: SOFT_DELETE_SCOPE.active, seriesId, userId },
      ...noteEntityArgs,
    });
  }

  async listSeriesArchive(input: ListSeriesArchiveInput): Promise<NoteWithEntity[]> {
    const rows = await this.prisma.$queryRaw(buildSeriesNotesPageQuery(input));
    const orderedIds = z
      .array(NoteIdRowSchema)
      .parse(rows)
      .map((row) => row.id);
    if (orderedIds.length === 0) {
      return [];
    }

    const notes = await this.prisma.note.findMany({
      where: { id: { in: orderedIds } },
      ...noteEntityArgs,
    });
    const notesById = new Map(notes.map((note) => [note.id, note]));

    return orderedIds.flatMap((id) => {
      const note = notesById.get(id);
      return note === undefined ? [] : [note];
    });
  }

  async listTrashed({
    skip,
    take,
    userId,
  }: {
    skip: number;
    take: number;
    userId: string;
  }): Promise<TrashedNoteRow[]> {
    const rows = await this.prisma.note.findMany({
      orderBy: [{ deletedAt: "desc" }, { id: "asc" }],
      select: trashedNoteSelect,
      skip,
      take,
      where: { AND: [{ ...SOFT_DELETE_SCOPE.trashed, userId }, NOTE_ON_ACTIVE_ENTITY] },
    });
    return rows.filter(isTrashed);
  }

  async restore({ noteId, userId }: { noteId: string; userId: string }): Promise<number> {
    const restored = await this.prisma.note.updateMany({
      data: SOFT_DELETE_SCOPE.restored,
      where: { AND: [{ ...SOFT_DELETE_SCOPE.trashed, id: noteId, userId }, NOTE_ON_ACTIVE_ENTITY] },
    });
    return restored.count;
  }

  async softDelete({
    noteId,
    stamp,
    userId,
  }: {
    noteId: string;
    stamp: TrashStamp;
    userId: string;
  }): Promise<number> {
    const deleted = await this.prisma.note.updateMany({
      data: stamp,
      where: { ...SOFT_DELETE_SCOPE.active, id: noteId, userId },
    });
    return deleted.count;
  }

  update({ fields, noteId, userId }: UpdateNoteArgs): Promise<NoteWithEntity> {
    return this.prisma.note.update({
      data: fields,
      where: { ...SOFT_DELETE_SCOPE.active, id: noteId, userId },
      ...noteEntityArgs,
    });
  }
}
