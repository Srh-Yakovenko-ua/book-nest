import type {
  ReadingStatisticsActivityPage,
  ReadingStatisticsCompletedReadsPage,
  ReadingStatisticsCompletedReadsSubsetPage,
  ReadingStatisticsCompletedReadsSubsetQuery,
  ReadingStatisticsIntervalQuery,
} from "@app/shared";

import { isoDay, pickReadingStatisticsSubsetFilter } from "@app/shared";
import { Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import { z } from "zod";

import type { CompletedReadsSubsetScope } from "../infrastructure/statistics-completion.repository.js";

import { BadRequestError } from "../../../core/exceptions/errors.js";
import { toIsoDate } from "../../../core/iso-date.js";
import { ReadingHistoryProvenanceService } from "../../books/index.js";
import { MediaService } from "../../media/index.js";
import { isRangeFullyReliable } from "../domain/activity-history-quality.js";
import { toCompletedReadRef } from "../domain/completed-read.js";
import { toActiveDays } from "../domain/reading-calendar.js";
import { StatisticsActivityRepository } from "../infrastructure/statistics-activity.repository.js";
import { StatisticsCompletionRepository } from "../infrastructure/statistics-completion.repository.js";
import { CompletedReadMapper } from "./completed-read.mapper.js";
import { statisticsCursorCodec } from "./statistics-cursor.js";

const COMPLETED_READS_SUBSET = {
  filterRequiredMessage: "Exactly one of authorId, genre, language or publisherId is required",
  scopeDigestAlgorithm: "sha256",
} as const;

const CompletedReadsCursorSchema = z.object({ finishedAt: isoDay(), id: z.uuid() });

const ActivityContributionsCursorSchema = z.object({
  bookId: z.uuid(),
  date: isoDay(),
  pagesRead: z.number().int().nonnegative(),
});

type CompletedReadsSubsetInput = {
  query: ReadingStatisticsCompletedReadsSubsetQuery;
  userId: string;
};

type IntervalDetailsInput = { query: ReadingStatisticsIntervalQuery; userId: string };

@Injectable()
export class ReadingIntervalDetailsService {
  constructor(
    private readonly activityRepository: StatisticsActivityRepository,
    private readonly completedReadMapper: CompletedReadMapper,
    private readonly completionRepository: StatisticsCompletionRepository,
    private readonly mediaService: MediaService,
    private readonly readingHistoryProvenanceService: ReadingHistoryProvenanceService,
  ) {}

  async getCompletedReads({
    query,
    userId,
  }: IntervalDetailsInput): Promise<ReadingStatisticsCompletedReadsPage> {
    const scope = { from: query.from, to: query.to, userId };
    const after = statisticsCursorCodec.decode({
      schema: CompletedReadsCursorSchema,
      value: query.cursor,
    });
    const [rows, totals] = await Promise.all([
      this.completionRepository.findCompletedReadsPage({ ...scope, after, limit: query.limit + 1 }),
      this.completionRepository.countTotals(scope),
    ]);
    const page = rows.slice(0, query.limit);
    const last = page.at(-1);

    return {
      items: this.completedReadMapper.toCompletedReads(page).map(toCompletedReadRef),
      nextCursor:
        rows.length > query.limit && last !== undefined && last.finishedAt !== null
          ? statisticsCursorCodec.encode({ finishedAt: toIsoDate(last.finishedAt), id: last.id })
          : null,
      range: { from: query.from, to: query.to },
      totalCount: totals.completedReads,
    };
  }

  async getCompletedReadsSubset({
    query,
    userId,
  }: CompletedReadsSubsetInput): Promise<ReadingStatisticsCompletedReadsSubsetPage> {
    const filter = pickReadingStatisticsSubsetFilter(query);
    if (filter === null) {
      throw new BadRequestError(COMPLETED_READS_SUBSET.filterRequiredMessage);
    }

    const scope: CompletedReadsSubsetScope = {
      filter,
      from: query.periodFrom ?? null,
      to: query.periodTo,
      userId,
    };
    const scopeFingerprint = fingerprintCompletedReadsSubsetScope(scope);
    const after = statisticsCursorCodec.decode({
      schema: CompletedReadsCursorSchema.extend({ scope: z.literal(scopeFingerprint) }),
      value: query.cursor,
    });
    const [rows, totalCount] = await Promise.all([
      this.completionRepository.findCompletedReadsSubsetPage({
        ...scope,
        after,
        limit: query.limit + 1,
      }),
      this.completionRepository.countCompletedReadsSubset(scope),
    ]);
    const page = rows.slice(0, query.limit);
    const last = page.at(-1);

    return {
      items: this.completedReadMapper.toCompletedReads(page).map(toCompletedReadRef),
      nextCursor:
        rows.length > query.limit && last !== undefined && last.finishedAt !== null
          ? statisticsCursorCodec.encode({
              finishedAt: toIsoDate(last.finishedAt),
              id: last.id,
              scope: scopeFingerprint,
            })
          : null,
      totalCount,
    };
  }

  async getReadingActivity({
    query,
    userId,
  }: IntervalDetailsInput): Promise<ReadingStatisticsActivityPage> {
    const scope = { from: query.from, to: query.to, userId };
    const after = statisticsCursorCodec.decode({
      schema: ActivityContributionsCursorSchema,
      value: query.cursor,
    });
    const [rows, days, pagesByBook, { activityReliableFrom }] = await Promise.all([
      this.activityRepository.findContributionsPage({ ...scope, after, limit: query.limit + 1 }),
      this.activityRepository.aggregateDays(scope),
      this.activityRepository.aggregatePagesByBook(scope),
      this.readingHistoryProvenanceService.ensure(userId),
    ]);
    const page = rows.slice(0, query.limit);
    const last = page.at(-1);

    return {
      activeDays: toActiveDays(days).length,
      booksCount: [...pagesByBook.values()].filter((pagesRead) => pagesRead > 0).length,
      historyQuality: isRangeFullyReliable({ from: query.from, reliableFrom: activityReliableFrom })
        ? "exact"
        : "legacy_observed_only",
      items: page.map((row) => ({
        book: {
          bookId: row.bookId,
          bookState: row.deletedAt === null ? "active" : "soft_deleted",
          coverThumbUrl: this.mediaService.buildThumbUrlOrNull(row.coverMedia),
          title: row.title,
        },
        date: row.date,
        pagesRead: row.pagesRead,
      })),
      nextCursor:
        rows.length > query.limit && last !== undefined
          ? statisticsCursorCodec.encode({
              bookId: last.bookId,
              date: last.date,
              pagesRead: last.pagesRead,
            })
          : null,
      pagesRead: days.reduce((sum, day) => sum + day.pagesRead, 0),
      range: { from: query.from, to: query.to },
      reliableFrom: activityReliableFrom,
    };
  }
}

function fingerprintCompletedReadsSubsetScope({
  filter,
  from,
  to,
  userId,
}: CompletedReadsSubsetScope): string {
  return createHash(COMPLETED_READS_SUBSET.scopeDigestAlgorithm)
    .update(JSON.stringify([userId, from, to, filter.field, filter.value]))
    .digest("base64url");
}
