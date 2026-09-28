import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { SOFT_DELETE_SCOPE } from "../../../core/database/soft-delete.js";

export type BookChapterUsageRow = {
  chapter: string;
  count: number;
};

type ChapterGroup = {
  _count: { _all: number };
  chapter: null | string;
};

@Injectable()
export class BookChaptersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findChapterUsage(
    { bookId }: { bookId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<BookChapterUsageRow[]> {
    const [noteGroups, quoteGroups, timelineEventGroups] = await Promise.all([
      client.note.groupBy({
        _count: { _all: true },
        by: ["chapter"],
        where: { ...SOFT_DELETE_SCOPE.active, bookId, chapter: { not: null } },
      }),
      client.quote.groupBy({
        _count: { _all: true },
        by: ["chapter"],
        where: { ...SOFT_DELETE_SCOPE.active, bookId, chapter: { not: null } },
      }),
      client.bookTimelineEvent.groupBy({
        _count: { _all: true },
        by: ["chapter"],
        where: { bookId, chapter: { not: null } },
      }),
    ]);

    return toUsageRows([...noteGroups, ...quoteGroups, ...timelineEventGroups]);
  }
}

function toUsageRows(groups: ChapterGroup[]): BookChapterUsageRow[] {
  return groups.flatMap((group) =>
    group.chapter === null ? [] : [{ chapter: group.chapter, count: group._count._all }],
  );
}
