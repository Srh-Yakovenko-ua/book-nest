import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { SOFT_DELETE_SCOPE } from "../../../core/database/soft-delete.js";
import { READING_CYCLE_STATE } from "../../books/index.js";

const homeBookPresentationSelect = {
  _count: {
    select: { readingCycles: { where: { state: { not: READING_CYCLE_STATE.active } } } },
  },
  authors: {
    orderBy: { position: "asc" },
    select: { author: { select: { id: true, name: true } } },
  },
  coverMedia: true,
  id: true,
  isFavorite: true,
  ownershipStatus: true,
  pagesCount: true,
  partNumber: true,
  queuePosition: true,
  queuePriority: true,
  queuePriorityReason: true,
  queuePriorityTargetDate: true,
  readingCycles: {
    select: { _count: { select: { events: true } }, startedAt: true },
    where: { state: READING_CYCLE_STATE.active },
  },
  readingProgress: { select: { currentPage: true } },
  readingStatus: true,
  series: { select: { deletedAt: true, id: true, name: true } },
  title: true,
} satisfies Prisma.BookSelect;

export type HomeBookPresentationRow = Prisma.BookGetPayload<{
  select: typeof homeBookPresentationSelect;
}>;

@Injectable()
export class HomeBookPresentationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findPresentations({
    bookIds,
    userId,
  }: {
    bookIds: string[];
    userId: string;
  }): Promise<HomeBookPresentationRow[]> {
    if (bookIds.length === 0) {
      return [];
    }
    return this.prisma.book.findMany({
      select: homeBookPresentationSelect,
      where: { ...SOFT_DELETE_SCOPE.active, id: { in: bookIds }, userId },
    });
  }
}
