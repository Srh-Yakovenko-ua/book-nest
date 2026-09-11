import type { Nullable } from "@app/shared";

import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { PostFinishCandidate, PostFinishQuoteCounts } from "../domain/quote-post-finish.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { SOFT_DELETE_SCOPE } from "../../../core/database/soft-delete.js";
import { READING_CYCLE_STATE } from "../../books/index.js";

const postFinishBookSelect = {
  coverMedia: true,
  firstAuthorName: true,
  id: true,
  title: true,
} satisfies Prisma.BookSelect;

export type PostFinishBookRow = Prisma.BookGetPayload<{ select: typeof postFinishBookSelect }>;

export type PostFinishQuoteCountsRow = PostFinishQuoteCounts & {
  bookId: string;
};

@Injectable()
export class QuotePostFinishRepository {
  constructor(private readonly prisma: PrismaService) {}

  async aggregateActiveQuoteCounts({
    bookIds,
    userId,
  }: {
    bookIds: string[];
    userId: string;
  }): Promise<PostFinishQuoteCountsRow[]> {
    if (bookIds.length === 0) {
      return [];
    }

    const where = buildActiveQuotesWhere({ bookIds, userId });
    const [totals, favorites] = await Promise.all([
      this.prisma.quote.groupBy({
        _count: { _all: true, comment: true },
        by: ["bookId"],
        where,
      }),
      this.prisma.quote.groupBy({
        _count: { _all: true },
        by: ["bookId"],
        where: { ...where, isFavorite: true },
      }),
    ]);

    const favoritesByBookId = new Map(
      favorites.map((group) => [group.bookId, group._count._all] as const),
    );

    return totals.map((group) => ({
      bookId: group.bookId,
      favoritesCount: favoritesByBookId.get(group.bookId) ?? 0,
      quotesCount: group._count._all,
      withCommentCount: group._count.comment,
    }));
  }

  countOwnedCycles({
    readingCycleId,
    userId,
  }: {
    readingCycleId: string;
    userId: string;
  }): Promise<number> {
    return this.prisma.bookReadingCycle.count({ where: { id: readingCycleId, userId } });
  }

  findBookPreview({
    bookId,
    userId,
  }: {
    bookId: string;
    userId: string;
  }): Promise<Nullable<PostFinishBookRow>> {
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
  }): Promise<PostFinishCandidate[]> {
    const rows = await this.prisma.bookReadingCycle.findMany({
      orderBy: [{ finishedAt: "desc" }, { id: "asc" }],
      select: { bookId: true, finishedAt: true, id: true },
      where: {
        book: SOFT_DELETE_SCOPE.active,
        finishedAt: { gte: finishedFrom, lte: finishedTo },
        quotePostFinishReviews: { none: { userId } },
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
    const created = await this.prisma.quotePostFinishReview.createMany({
      data: [{ readingCycleId, reviewedAt, userId }],
      skipDuplicates: true,
    });
    return created.count;
  }
}

function buildActiveQuotesWhere({
  bookIds,
  userId,
}: {
  bookIds: string[];
  userId: string;
}): Prisma.QuoteWhereInput {
  return {
    ...SOFT_DELETE_SCOPE.active,
    book: SOFT_DELETE_SCOPE.active,
    bookId: { in: bookIds },
    userId,
  };
}
