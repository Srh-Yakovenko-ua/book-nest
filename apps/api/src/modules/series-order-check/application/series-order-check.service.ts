import type {
  ApplySeriesOrderFixResponse,
  MediaView,
  Nullable,
  SeriesOrderFixInput,
  SeriesOrderFixPreviewView,
  SeriesOrderFixStrategy,
  SeriesOrderIssuesView,
  SeriesOrderPreferenceView,
} from "@app/shared";

import {
  OwnershipStatusSchema,
  READING_QUEUE_LIMIT,
  ReadingStatusSchema,
  SERIES_ORDER_ERROR_CODES,
  SERIES_ORDER_ISSUES_LIMIT_DEFAULT,
} from "@app/shared";
import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { MediaAssetModel } from "../../../generated/prisma/models.js";
import type {
  SeriesOrderDetectedIssue,
  SeriesOrderDetectionBook,
  SeriesOrderDetectionSeries,
} from "../domain/series-order-detection.js";
import type { RelevantSeriesBook } from "../infrastructure/series-order-check.repository.js";

import { TransactionRunner } from "../../../core/database/transaction-runner.js";
import { ConflictError, NotFoundError, ValidationError } from "../../../core/exceptions/errors.js";
import { createLogger } from "../../../core/logger.js";
import { MediaService } from "../../media/index.js";
import { ReadingQueueRepository } from "../../reading-queue/index.js";
import { computeQueueVersion } from "../domain/queue-version.js";
import { detectSeriesOrderIssues } from "../domain/series-order-detection.js";
import { computeSeriesOrderFingerprint } from "../domain/series-order-fingerprint.js";
import { computeFixPlan } from "../domain/series-order-fix-plan.js";
import { SeriesOrderCheckRepository } from "../infrastructure/series-order-check.repository.js";
import {
  toSeriesOrderFixPreviewView,
  toSeriesOrderIssueView,
} from "./series-order-issue.mapper.js";

const log = createLogger("series-order-check.service");

const ISSUE_STALE_MESSAGE = "Проблема більше не актуальна";
const SERIES_NOT_FOUND_MESSAGE = "Series not found";
const SERIES_NOT_FOUND_CODE = "SERIES_NOT_FOUND";
const QUEUE_STALE_MESSAGE = "Черга читання змінилася, оновіть і спробуйте ще раз";
const INVALID_FIX_STRATEGY_MESSAGE = "Ця дія недоступна для цієї проблеми";
const ALREADY_IN_QUEUE_MESSAGE = "Книга вже є в черзі читання";
const QUEUE_LIMIT_REACHED_MESSAGE = "Досягнуто ліміт черги читання";

const ADD_STRATEGIES: ReadonlySet<SeriesOrderFixStrategy> = new Set<SeriesOrderFixStrategy>([
  "ADD_ALL_PREVIOUS_BEFORE",
  "ADD_NEXT_PREVIOUS_BEFORE",
]);

type FingerprintedIssue = {
  fingerprint: string;
  issue: SeriesOrderDetectedIssue;
};

@Injectable()
export class SeriesOrderCheckService {
  constructor(
    private readonly repository: SeriesOrderCheckRepository,
    private readonly mediaService: MediaService,
    private readonly readingQueueRepository: ReadingQueueRepository,
    private readonly transactionRunner: TransactionRunner,
  ) {}

  async applyFix({
    fingerprint,
    input,
    userId,
  }: {
    fingerprint: string;
    input: SeriesOrderFixInput;
    userId: string;
  }): Promise<ApplySeriesOrderFixResponse> {
    return this.transactionRunner.run(async (tx) => {
      await this.readingQueueRepository.acquireUserQueueLock(userId, tx);

      const fingerprintedIssues = await this.computeIssues({ client: tx, userId });
      const currentQueueVersion = computeQueueVersion(
        await this.repository.loadQueueSignature(userId, tx),
      );
      if (input.expectedQueueVersion !== currentQueueVersion) {
        throw new ConflictError(QUEUE_STALE_MESSAGE, {
          code: SERIES_ORDER_ERROR_CODES.QUEUE_STALE,
        });
      }

      const issue = this.findIssueOrThrow({ fingerprint, fingerprintedIssues });
      this.assertStrategyAllowed({ issue, strategy: input.strategy });

      const queue = await this.repository.loadFullQueue(userId, tx);
      const plan = computeFixPlan({
        issue,
        queue,
        queueLimit: READING_QUEUE_LIMIT,
        strategy: input.strategy,
      });

      if (ADD_STRATEGIES.has(input.strategy)) {
        const queuedBookIds = new Set(queue.map((item) => item.bookId));
        if (plan.addedBookIds.some((bookId) => queuedBookIds.has(bookId))) {
          throw new ConflictError(ALREADY_IN_QUEUE_MESSAGE, {
            code: SERIES_ORDER_ERROR_CODES.ALREADY_IN_QUEUE,
          });
        }
        if (plan.limitExceeded) {
          throw new ValidationError(QUEUE_LIMIT_REACHED_MESSAGE, {
            code: SERIES_ORDER_ERROR_CODES.QUEUE_LIMIT_REACHED,
          });
        }
      }

      for (const change of plan.changes) {
        await this.readingQueueRepository.setPosition(userId, change.bookId, change.toPosition, tx);
      }

      const nextQueueVersion = computeQueueVersion(
        await this.repository.loadQueueSignature(userId, tx),
      );
      return {
        addedBookIds: plan.addedBookIds,
        changedBookIds: plan.movedBookIds,
        queueVersion: nextQueueVersion,
        resolvedFingerprint: fingerprint,
        success: true,
      };
    });
  }

  async ignoreIssue({
    fingerprint,
    userId,
  }: {
    fingerprint: string;
    userId: string;
  }): Promise<SeriesOrderIssuesView> {
    const fingerprintedIssues = await this.computeIssues({ userId });
    const issue = this.findIssueOrThrow({ fingerprint, fingerprintedIssues });

    await this.repository.addIgnoredIssue({ fingerprint, seriesId: issue.series.id, userId });

    return this.listIssues({ limit: SERIES_ORDER_ISSUES_LIMIT_DEFAULT, userId });
  }

  async listIssues({
    limit,
    userId,
  }: {
    limit: number;
    userId: string;
  }): Promise<SeriesOrderIssuesView> {
    const [relevantBooks, fingerprintedIssues, queueSignature] = await Promise.all([
      this.repository.loadRelevantSeries(userId),
      this.computeIssues({ userId }),
      this.repository.loadQueueSignature(userId),
    ]);

    const coverByBookId = this.buildCoverMap(relevantBooks);
    const items = fingerprintedIssues
      .slice(0, limit)
      .map(({ fingerprint, issue }) =>
        toSeriesOrderIssueView({ coverByBookId, fingerprint, issue }),
      );

    return {
      items,
      queueVersion: computeQueueVersion(queueSignature),
      total: fingerprintedIssues.length,
    };
  }

  async previewFix({
    fingerprint,
    input,
    userId,
  }: {
    fingerprint: string;
    input: SeriesOrderFixInput;
    userId: string;
  }): Promise<SeriesOrderFixPreviewView> {
    const [fingerprintedIssues, queueSignature, queue] = await Promise.all([
      this.computeIssues({ userId }),
      this.repository.loadQueueSignature(userId),
      this.repository.loadFullQueue(userId),
    ]);

    const issue = this.findIssueOrThrow({ fingerprint, fingerprintedIssues });
    this.assertStrategyAllowed({ issue, strategy: input.strategy });

    const plan = computeFixPlan({
      issue,
      queue,
      queueLimit: READING_QUEUE_LIMIT,
      strategy: input.strategy,
    });

    return toSeriesOrderFixPreviewView({
      fingerprint,
      plan,
      queueVersion: computeQueueVersion(queueSignature),
      series: issue.series,
      strategy: input.strategy,
    });
  }

  async setSeriesCheckPreference({
    enabled,
    seriesId,
    userId,
  }: {
    enabled: boolean;
    seriesId: string;
    userId: string;
  }): Promise<SeriesOrderPreferenceView> {
    const ownedSeriesId = await this.repository.findOwnedSeriesId({ seriesId, userId });
    if (ownedSeriesId === null) {
      throw new NotFoundError(SERIES_NOT_FOUND_MESSAGE, { code: SERIES_NOT_FOUND_CODE });
    }

    if (enabled) {
      await this.repository.enableSeries({ seriesId, userId });
    } else {
      await this.repository.disableSeries({ seriesId, userId });
    }

    return { enabled };
  }

  private assertStrategyAllowed({
    issue,
    strategy,
  }: {
    issue: SeriesOrderDetectedIssue;
    strategy: SeriesOrderFixStrategy;
  }): void {
    if (!issue.primary.allowedActions.includes(strategy)) {
      throw new ValidationError(INVALID_FIX_STRATEGY_MESSAGE, {
        code: SERIES_ORDER_ERROR_CODES.INVALID_FIX_STRATEGY,
      });
    }
  }

  private buildCoverMap(relevantBooks: RelevantSeriesBook[]): Map<string, Nullable<MediaView>> {
    return new Map(relevantBooks.map((book) => [book.id, this.coverViewOf(book)]));
  }

  private buildDetectionSeries({
    disabledSeries,
    relevantBooks,
  }: {
    disabledSeries: Set<string>;
    relevantBooks: RelevantSeriesBook[];
  }): SeriesOrderDetectionSeries[] {
    const booksBySeriesId = new Map<string, RelevantSeriesBook[]>();
    for (const book of relevantBooks) {
      if (book.seriesId === null || disabledSeries.has(book.seriesId)) {
        continue;
      }
      const group = booksBySeriesId.get(book.seriesId) ?? [];
      group.push(book);
      booksBySeriesId.set(book.seriesId, group);
    }

    return [...booksBySeriesId].map(([seriesId, books]) => ({
      books: books.map(toDetectionBook),
      id: seriesId,
      title: books[0]?.series?.name ?? "",
    }));
  }

  private async computeIssues({
    client,
    userId,
  }: {
    client?: Prisma.TransactionClient;
    userId: string;
  }): Promise<FingerprintedIssue[]> {
    const [relevantBooks, disabledSeriesIds, ignoredFingerprints] = await Promise.all([
      this.repository.loadRelevantSeries(userId, client),
      this.repository.listDisabledSeriesIds(userId, client),
      this.repository.listIgnoredFingerprints(userId, client),
    ]);

    const disabledSeries = new Set(disabledSeriesIds);
    const ignored = new Set(ignoredFingerprints);
    const seriesList = this.buildDetectionSeries({ disabledSeries, relevantBooks });

    return detectSeriesOrderIssues(seriesList)
      .map((issue) => ({ fingerprint: computeSeriesOrderFingerprint({ issue, userId }), issue }))
      .filter(({ fingerprint }) => !ignored.has(fingerprint));
  }

  private coverViewOf(book: {
    coverMedia: Nullable<MediaAssetModel>;
    id: string;
  }): Nullable<MediaView> {
    if (book.coverMedia === null) {
      return null;
    }
    try {
      return this.mediaService.buildView(book.coverMedia);
    } catch (error) {
      log.warn({ bookId: book.id, err: error }, "failed to build cover view");
      return null;
    }
  }

  private findIssueOrThrow({
    fingerprint,
    fingerprintedIssues,
  }: {
    fingerprint: string;
    fingerprintedIssues: FingerprintedIssue[];
  }): SeriesOrderDetectedIssue {
    const found = fingerprintedIssues.find((entry) => entry.fingerprint === fingerprint);
    if (found === undefined) {
      throw new ConflictError(ISSUE_STALE_MESSAGE, { code: SERIES_ORDER_ERROR_CODES.ISSUE_STALE });
    }
    return found.issue;
  }
}

function toDetectionBook(book: RelevantSeriesBook): SeriesOrderDetectionBook {
  return {
    createdAt: book.createdAt,
    id: book.id,
    ownershipStatus: OwnershipStatusSchema.parse(book.ownershipStatus),
    partNumber: book.partNumber,
    queuePosition: book.queuePosition,
    readingStatus: ReadingStatusSchema.parse(book.readingStatus),
    title: book.title,
  };
}
