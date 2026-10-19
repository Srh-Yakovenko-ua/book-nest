import type { Nullable } from "@app/shared";

import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { BookSeriesLink, TimelineLocationScope } from "../domain/location-scope.js";

import { assertNever } from "../../../core/assert-never.js";
import { PrismaService } from "../../../core/database/prisma.service.js";
import { SOFT_DELETE_SCOPE } from "../../../core/database/soft-delete.js";

export type OwnedBookSeriesRow = {
  series: BookSeriesLink;
};

export type TimelineLocationUsageRow = {
  count: number;
  location: string;
};

@Injectable()
export class TimelineLocationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findLocationUsage(
    scope: TimelineLocationScope,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<TimelineLocationUsageRow[]> {
    const groups = await client.bookTimelineEvent.groupBy({
      _count: { _all: true },
      by: ["location"],
      where: {
        ...buildScopeWhere(scope),
        location: { not: null },
        timeline: SOFT_DELETE_SCOPE.active,
      },
    });

    return groups.flatMap((group) =>
      group.location === null ? [] : [{ count: group._count._all, location: group.location }],
    );
  }

  findOwnedBookSeries(
    { bookId, userId }: { bookId: string; userId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<Nullable<OwnedBookSeriesRow>> {
    return client.book.findFirst({
      select: { series: { select: { deletedAt: true, id: true, userId: true } } },
      where: { ...SOFT_DELETE_SCOPE.active, id: bookId, userId },
    });
  }
}

function buildScopeWhere(scope: TimelineLocationScope): Prisma.BookTimelineEventWhereInput {
  switch (scope.kind) {
    case "book":
      return { bookId: scope.bookId };
    case "series":
      return {
        book: { ...SOFT_DELETE_SCOPE.active, seriesId: scope.seriesId, userId: scope.userId },
      };
    default:
      return assertNever(scope);
  }
}
