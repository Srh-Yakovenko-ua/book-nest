import type { MediaView, Nullable, SeriesOrderIssuesView } from "@app/shared";

import { OwnershipStatusSchema, ReadingStatusSchema } from "@app/shared";
import { Injectable } from "@nestjs/common";

import type { MediaAssetModel } from "../../../generated/prisma/models.js";
import type {
  SeriesOrderDetectionBook,
  SeriesOrderDetectionSeries,
} from "../domain/series-order-detection.js";
import type { RelevantSeriesBook } from "../infrastructure/series-order-check.repository.js";

import { createLogger } from "../../../core/logger.js";
import { MediaService } from "../../media/index.js";
import { computeQueueVersion } from "../domain/queue-version.js";
import { detectSeriesOrderIssues } from "../domain/series-order-detection.js";
import { computeSeriesOrderFingerprint } from "../domain/series-order-fingerprint.js";
import { SeriesOrderCheckRepository } from "../infrastructure/series-order-check.repository.js";
import { toSeriesOrderIssueView } from "./series-order-issue.mapper.js";

const log = createLogger("series-order-check.service");

@Injectable()
export class SeriesOrderCheckService {
  constructor(
    private readonly repository: SeriesOrderCheckRepository,
    private readonly mediaService: MediaService,
  ) {}

  async listIssues({
    limit,
    userId,
  }: {
    limit: number;
    userId: string;
  }): Promise<SeriesOrderIssuesView> {
    const [relevantBooks, disabledSeriesIds, ignoredFingerprints, queueSignature] =
      await Promise.all([
        this.repository.loadRelevantSeries(userId),
        this.repository.listDisabledSeriesIds(userId),
        this.repository.listIgnoredFingerprints(userId),
        this.repository.loadQueueSignature(userId),
      ]);

    const disabledSeries = new Set(disabledSeriesIds);
    const ignored = new Set(ignoredFingerprints);
    const coverByBookId = this.buildCoverMap(relevantBooks);
    const seriesList = this.buildDetectionSeries({ disabledSeries, relevantBooks });

    const fingerprintedIssues = detectSeriesOrderIssues(seriesList)
      .map((issue) => ({ fingerprint: computeSeriesOrderFingerprint({ issue, userId }), issue }))
      .filter(({ fingerprint }) => !ignored.has(fingerprint));

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
