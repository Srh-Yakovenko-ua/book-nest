import { READING_QUEUE_LIMIT } from "@app/shared";
import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { SOFT_DELETE_SCOPE } from "../../../core/database/soft-delete.js";
import { NEXT_READ_ELIGIBILITY } from "../domain/next-read-eligibility.js";

const queueEntrySelect = {
  id: true,
  ownershipStatus: true,
  queuePosition: true,
  readingStatus: true,
} satisfies Prisma.BookSelect;

const libraryCandidateSelect = {
  createdAt: true,
  id: true,
  isFavorite: true,
  readingStatus: true,
  series: { select: { deletedAt: true } },
  seriesId: true,
} satisfies Prisma.BookSelect;

const seriesBookSelect = {
  createdAt: true,
  id: true,
  partNumber: true,
  readingStatus: true,
  seriesId: true,
} satisfies Prisma.BookSelect;

export type LibraryCandidateRow = Prisma.BookGetPayload<{ select: typeof libraryCandidateSelect }>;

export type QueueEntryRow = Prisma.BookGetPayload<{ select: typeof queueEntrySelect }>;

export type SeriesBookRow = Prisma.BookGetPayload<{ select: typeof seriesBookSelect }>;

@Injectable()
export class HomeNextReadRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findDisabledSeriesIds({
    seriesIds,
    userId,
  }: {
    seriesIds: string[];
    userId: string;
  }): Promise<string[]> {
    if (seriesIds.length === 0) {
      return [];
    }
    const rows = await this.prisma.seriesOrderDisabledSeries.findMany({
      select: { seriesId: true },
      where: { seriesId: { in: seriesIds }, userId },
    });
    return rows.map((row) => row.seriesId);
  }

  findLibraryCandidates(userId: string): Promise<LibraryCandidateRow[]> {
    return this.prisma.book.findMany({
      select: libraryCandidateSelect,
      where: {
        ...SOFT_DELETE_SCOPE.active,
        ownershipStatus: { in: [...NEXT_READ_ELIGIBILITY.availableOwnership] },
        queuePosition: null,
        readingStatus: { in: [...NEXT_READ_ELIGIBILITY.libraryStatuses] },
        userId,
      },
    });
  }

  findQueueEntries(userId: string): Promise<QueueEntryRow[]> {
    return this.prisma.book.findMany({
      orderBy: [{ queuePosition: "asc" }, { id: "asc" }],
      select: queueEntrySelect,
      take: READING_QUEUE_LIMIT,
      where: { ...SOFT_DELETE_SCOPE.active, queuePosition: { not: null }, userId },
    });
  }

  async findSeriesBooks({
    seriesIds,
    userId,
  }: {
    seriesIds: string[];
    userId: string;
  }): Promise<SeriesBookRow[]> {
    if (seriesIds.length === 0) {
      return [];
    }
    return this.prisma.book.findMany({
      select: seriesBookSelect,
      where: { ...SOFT_DELETE_SCOPE.active, seriesId: { in: seriesIds }, userId },
    });
  }
}
