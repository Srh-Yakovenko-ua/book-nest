import type { OwnershipStatus, ReadingStatus } from "@app/shared";

import { Injectable } from "@nestjs/common";
import { z } from "zod";

import { ACTIVE_BOOK_SQL } from "../../../core/database/active-book-sql.js";
import { PrismaService } from "../../../core/database/prisma.service.js";
import { SOFT_DELETE_SCOPE } from "../../../core/database/soft-delete.js";
import { Prisma } from "../../../generated/prisma/client.js";
import { FIRST_COMPLETION_RELIABILITY, READING_CYCLE_STATE } from "../../books/index.js";

const LIBRARY_BALANCE_STATUSES = {
  owned: ["owned", "lent_to_someone"],
  read: ["finished", "rereading"],
  toBeRead: ["not_started", "want_to_read", "reading", "paused", "dnf"],
} as const satisfies {
  owned: readonly OwnershipStatus[];
  read: readonly ReadingStatus[];
  toBeRead: readonly ReadingStatus[];
};

const ForecastSampleRowSchema = z.object({
  provenFirstCompletions: z.number().int().nonnegative(),
  unresolvedFirstCompletions: z.number().int().nonnegative(),
});

export type LibraryForecastSample = z.infer<typeof ForecastSampleRowSchema>;

export type LibrarySnapshot = {
  ownedTotal: number;
  readCount: number;
  tbrCount: number;
};

@Injectable()
export class StatisticsLibraryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async loadForecastSample({
    since,
    userId,
  }: {
    since: string;
    userId: string;
  }): Promise<LibraryForecastSample> {
    const rows = await this.prisma.$queryRaw`
      SELECT
        (COUNT(DISTINCT cycle.book_id) FILTER (
          WHERE cycle.first_completion_reliability = ${FIRST_COMPLETION_RELIABILITY.provenFirst}
        ))::int AS "provenFirstCompletions",
        (COUNT(DISTINCT cycle.book_id) FILTER (
          WHERE cycle.first_completion_reliability IS DISTINCT FROM ${FIRST_COMPLETION_RELIABILITY.provenFirst}
            AND cycle.first_completion_reliability IS DISTINCT FROM ${FIRST_COMPLETION_RELIABILITY.notFirst}
        ))::int AS "unresolvedFirstCompletions"
      FROM book_reading_cycles cycle
      JOIN books book ON book.id = cycle.book_id
      WHERE cycle.user_id = ${userId}::uuid
        AND cycle.state = ${READING_CYCLE_STATE.finished}
        AND cycle.finished_at >= ${since}::date
        ${ACTIVE_BOOK_SQL}
        AND book.ownership_status IN (${Prisma.join(LIBRARY_BALANCE_STATUSES.owned)})
    `;

    const [row] = z.array(ForecastSampleRowSchema).parse(rows);
    return row ?? { provenFirstCompletions: 0, unresolvedFirstCompletions: 0 };
  }

  async loadSnapshot(userId: string): Promise<LibrarySnapshot> {
    const ownedLibrary = {
      ...SOFT_DELETE_SCOPE.active,
      ownershipStatus: { in: [...LIBRARY_BALANCE_STATUSES.owned] },
      userId,
    };

    const [ownedTotal, readCount, tbrCount] = await Promise.all([
      this.prisma.book.count({ where: ownedLibrary }),
      this.prisma.book.count({
        where: { ...ownedLibrary, readingStatus: { in: [...LIBRARY_BALANCE_STATUSES.read] } },
      }),
      this.prisma.book.count({
        where: { ...ownedLibrary, readingStatus: { in: [...LIBRARY_BALANCE_STATUSES.toBeRead] } },
      }),
    ]);

    return { ownedTotal, readCount, tbrCount };
  }
}
