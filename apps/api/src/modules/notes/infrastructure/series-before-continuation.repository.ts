import type { Nullable } from "@app/shared";

import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { RecapNoteRow } from "../domain/series-before-continuation.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { SOFT_DELETE_SCOPE } from "../../../core/database/soft-delete.js";

const seriesShapeSelect = {
  books: {
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      createdAt: true,
      id: true,
      partNumber: true,
      readingCycles: { orderBy: { updatedAt: "desc" }, select: { updatedAt: true }, take: 1 },
      readingProgress: { select: { updatedAt: true } },
      readingStatus: true,
      title: true,
    },
    where: SOFT_DELETE_SCOPE.active,
  },
  id: true,
  name: true,
  totalBooks: true,
} satisfies Prisma.SeriesSelect;

const continuationBookSelect = {
  authors: {
    orderBy: { position: "asc" },
    select: { author: { select: { id: true, name: true } } },
  },
  coverMedia: true,
  id: true,
  ownershipStatus: true,
  pagesCount: true,
  partNumber: true,
  readingProgress: { select: { currentPage: true } },
  readingStatus: true,
  title: true,
} satisfies Prisma.BookSelect;

export type ContinuationBookRow = Prisma.BookGetPayload<{ select: typeof continuationBookSelect }>;

export type NoteActivityRow = {
  entityId: string;
  lastUpdatedAt: Date;
};

export type SeriesShapeRow = Prisma.SeriesGetPayload<{ select: typeof seriesShapeSelect }>;

@Injectable()
export class SeriesBeforeContinuationRepository {
  constructor(private readonly prisma: PrismaService) {}

  findContinuationBook({
    bookId,
    userId,
  }: {
    bookId: string;
    userId: string;
  }): Promise<Nullable<ContinuationBookRow>> {
    return this.prisma.book.findFirst({
      select: continuationBookSelect,
      where: { ...SOFT_DELETE_SCOPE.active, id: bookId, userId },
    });
  }

  async listBookNoteActivity({
    seriesIds,
    userId,
  }: {
    seriesIds: string[];
    userId: string;
  }): Promise<NoteActivityRow[]> {
    if (seriesIds.length === 0) {
      return [];
    }

    const groups = await this.prisma.note.groupBy({
      _max: { updatedAt: true },
      by: ["bookId"],
      where: {
        ...SOFT_DELETE_SCOPE.active,
        book: { ...SOFT_DELETE_SCOPE.active, seriesId: { in: seriesIds } },
        entityType: "book",
        userId,
      },
    });
    return groups.flatMap((group) =>
      group.bookId === null || group._max.updatedAt === null
        ? []
        : [{ entityId: group.bookId, lastUpdatedAt: group._max.updatedAt }],
    );
  }

  async listRecapNotes({
    bookIds,
    userId,
  }: {
    bookIds: string[];
    userId: string;
  }): Promise<RecapNoteRow[]> {
    if (bookIds.length === 0) {
      return [];
    }

    const rows = await this.prisma.note.findMany({
      orderBy: { id: "asc" },
      select: { bookId: true, id: true, isFavorite: true, isPinned: true, updatedAt: true },
      where: {
        ...SOFT_DELETE_SCOPE.active,
        book: SOFT_DELETE_SCOPE.active,
        bookId: { in: bookIds },
        entityType: "book",
        userId,
      },
    });
    return rows.flatMap((row) => (row.bookId === null ? [] : [{ ...row, bookId: row.bookId }]));
  }

  async listSeriesNoteActivity({
    seriesIds,
    userId,
  }: {
    seriesIds: string[];
    userId: string;
  }): Promise<NoteActivityRow[]> {
    if (seriesIds.length === 0) {
      return [];
    }

    const groups = await this.prisma.note.groupBy({
      _max: { updatedAt: true },
      by: ["seriesId"],
      where: {
        ...SOFT_DELETE_SCOPE.active,
        entityType: "series",
        series: SOFT_DELETE_SCOPE.active,
        seriesId: { in: seriesIds },
        userId,
      },
    });
    return groups.flatMap((group) =>
      group.seriesId === null || group._max.updatedAt === null
        ? []
        : [{ entityId: group.seriesId, lastUpdatedAt: group._max.updatedAt }],
    );
  }

  listSeriesShapes({
    seriesIds,
    userId,
  }: {
    seriesIds: Nullable<string[]>;
    userId: string;
  }): Promise<SeriesShapeRow[]> {
    return this.prisma.series.findMany({
      orderBy: { id: "asc" },
      select: seriesShapeSelect,
      where: {
        ...SOFT_DELETE_SCOPE.active,
        userId,
        ...(seriesIds === null ? {} : { id: { in: seriesIds } }),
      },
    });
  }
}
