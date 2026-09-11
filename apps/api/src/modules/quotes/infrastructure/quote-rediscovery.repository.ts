import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { SOFT_DELETE_SCOPE } from "../../../core/database/soft-delete.js";
import { hasQuoteComment } from "../domain/quote-text.js";

export type QuoteImpressionRow = {
  quoteId: string;
};

export type QuoteLastShownRow = {
  lastShownOn: Date;
  quoteId: string;
};

export type QuoteRediscoveryCandidateRow = {
  createdAt: Date;
  hasComment: boolean;
  id: string;
  isFavorite: boolean;
};

@Injectable()
export class QuoteRediscoveryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async countEligible({
    createdBefore,
    quoteId,
    userId,
  }: {
    createdBefore: Date;
    quoteId: string;
    userId: string;
  }): Promise<number> {
    return this.prisma.quote.count({
      where: { ...buildEligibleWhere({ createdBefore, userId }), id: quoteId },
    });
  }

  async listEligibleCandidates({
    createdBefore,
    userId,
  }: {
    createdBefore: Date;
    userId: string;
  }): Promise<QuoteRediscoveryCandidateRow[]> {
    const rows = await this.prisma.quote.findMany({
      orderBy: { id: "asc" },
      select: { comment: true, createdAt: true, id: true, isFavorite: true },
      where: buildEligibleWhere({ createdBefore, userId }),
    });

    return rows.map((row) => ({
      createdAt: row.createdAt,
      hasComment: hasQuoteComment(row.comment),
      id: row.id,
      isFavorite: row.isFavorite,
    }));
  }

  async listImpressionsOn({
    shownOn,
    userId,
  }: {
    shownOn: Date;
    userId: string;
  }): Promise<QuoteImpressionRow[]> {
    return this.prisma.quoteRediscoveryImpression.findMany({
      orderBy: { shownAt: "desc" },
      select: { quoteId: true },
      where: { shownOn, userId },
    });
  }

  async listLastShownDates(userId: string): Promise<QuoteLastShownRow[]> {
    const groups = await this.prisma.quoteRediscoveryImpression.groupBy({
      _max: { shownOn: true },
      by: ["quoteId"],
      where: { userId },
    });

    return groups.flatMap((group) => {
      const lastShownOn = group._max.shownOn;
      return lastShownOn === null ? [] : [{ lastShownOn, quoteId: group.quoteId }];
    });
  }

  async recordImpression({
    quoteId,
    shownAt,
    shownOn,
    userId,
  }: {
    quoteId: string;
    shownAt: Date;
    shownOn: Date;
    userId: string;
  }): Promise<number> {
    const created = await this.prisma.quoteRediscoveryImpression.createMany({
      data: [{ quoteId, shownAt, shownOn, userId }],
      skipDuplicates: true,
    });
    return created.count;
  }
}

function buildEligibleWhere({
  createdBefore,
  userId,
}: {
  createdBefore: Date;
  userId: string;
}): Prisma.QuoteWhereInput {
  return {
    ...SOFT_DELETE_SCOPE.active,
    book: SOFT_DELETE_SCOPE.active,
    createdAt: { lt: createdBefore },
    isSpoiler: false,
    userId,
  };
}
