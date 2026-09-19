import type { Nullable } from "@app/shared";

import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { NotePostFinishCandidate, NotePostFinishCounts } from "../domain/note-post-finish.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { SOFT_DELETE_SCOPE } from "../../../core/database/soft-delete.js";
import { READING_CYCLE_STATE } from "../../books/index.js";

const postFinishBookSelect = {
  coverMedia: true,
  firstAuthorName: true,
  id: true,
  title: true,
} satisfies Prisma.BookSelect;

export type NotePostFinishBookRow = Prisma.BookGetPayload<{ select: typeof postFinishBookSelect }>;

export type NotePostFinishCountsRow = NotePostFinishCounts & {
  bookId: string;
};

@Injectable()
export class NotePostFinishRepository {
  constructor(private readonly prisma: PrismaService) {}

  async aggregateActiveNoteCounts({
    bookIds,
    userId,
  }: {
    bookIds: string[];
    userId: string;
  }): Promise<NotePostFinishCountsRow[]> {
    if (bookIds.length === 0) {
      return [];
    }

    const where = buildActiveBookNotesWhere({ bookIds, userId });
    const [totals, favorites, pinned] = await Promise.all([
      this.prisma.note.groupBy({ _count: { _all: true }, by: ["bookId"], where }),
      this.prisma.note.groupBy({
        _count: { _all: true },
        by: ["bookId"],
        where: { ...where, isFavorite: true },
      }),
      this.prisma.note.groupBy({
        _count: { _all: true },
        by: ["bookId"],
        where: { ...where, isPinned: true },
      }),
    ]);

    const favoritesByBookId = countsByBookId(favorites);
    const pinnedByBookId = countsByBookId(pinned);

    return totals.flatMap((group) =>
      group.bookId === null
        ? []
        : [
            {
              bookId: group.bookId,
              favoritesCount: favoritesByBookId.get(group.bookId) ?? 0,
              notesCount: group._count._all,
              pinnedCount: pinnedByBookId.get(group.bookId) ?? 0,
            },
          ],
    );
  }

  countOwnedFinishedCycles({
    readingCycleId,
    userId,
  }: {
    readingCycleId: string;
    userId: string;
  }): Promise<number> {
    return this.prisma.bookReadingCycle.count({
      where: { id: readingCycleId, state: READING_CYCLE_STATE.finished, userId },
    });
  }

  findBookPreview({
    bookId,
    userId,
  }: {
    bookId: string;
    userId: string;
  }): Promise<Nullable<NotePostFinishBookRow>> {
    return this.prisma.book.findFirst({
      select: postFinishBookSelect,
      where: { ...SOFT_DELETE_SCOPE.active, id: bookId, userId },
    });
  }

  async listUnreviewedFinishedCycles({
    finishedFrom,
    finishedTo,
    userId,
  }: {
    finishedFrom: Date;
    finishedTo: Date;
    userId: string;
  }): Promise<NotePostFinishCandidate[]> {
    const rows = await this.prisma.bookReadingCycle.findMany({
      orderBy: [{ finishedAt: "desc" }, { id: "asc" }],
      select: { bookId: true, finishedAt: true, id: true },
      where: {
        book: SOFT_DELETE_SCOPE.active,
        finishedAt: { gte: finishedFrom, lte: finishedTo },
        notePostFinishReviews: { none: { userId } },
        state: READING_CYCLE_STATE.finished,
        userId,
      },
    });

    return rows.flatMap((row) =>
      row.finishedAt === null
        ? []
        : [{ bookId: row.bookId, finishedAt: row.finishedAt, id: row.id }],
    );
  }

  async recordReview({
    readingCycleId,
    reviewedAt,
    userId,
  }: {
    readingCycleId: string;
    reviewedAt: Date;
    userId: string;
  }): Promise<number> {
    const created = await this.prisma.notePostFinishReview.createMany({
      data: [{ readingCycleId, reviewedAt, userId }],
      skipDuplicates: true,
    });
    return created.count;
  }
}

function buildActiveBookNotesWhere({
  bookIds,
  userId,
}: {
  bookIds: string[];
  userId: string;
}): Prisma.NoteWhereInput {
  return {
    ...SOFT_DELETE_SCOPE.active,
    book: SOFT_DELETE_SCOPE.active,
    bookId: { in: bookIds },
    entityType: "book",
    userId,
  };
}

function countsByBookId(
  groups: { _count: { _all: number }; bookId: Nullable<string> }[],
): Map<string, number> {
  return new Map(
    groups.flatMap((group) => (group.bookId === null ? [] : [[group.bookId, group._count._all]])),
  );
}
