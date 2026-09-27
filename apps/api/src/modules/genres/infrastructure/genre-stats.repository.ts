import type { OwnershipStatus, ReadingStatus } from "@app/shared";

import { MediaKindSchema } from "@app/shared";
import { Injectable } from "@nestjs/common";
import { z } from "zod";

import type { MediaAssetModel } from "../../../generated/prisma/models.js";
import type { GenreAggregate } from "../domain/genre-aggregate.js";
import type { GenreLibraryCounts } from "../domain/genre-summary.js";
import type { GenreOverviewAggregate } from "../domain/genres-overview.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { Prisma } from "../../../generated/prisma/client.js";

export type GenreCoverPreviewRow = {
  coverMedia: MediaAssetModel;
  genreKey: string;
};

const READ_STATUS: ReadingStatus = "finished";
const WANT_TO_BUY_STATUS: OwnershipStatus = "want_to_buy";
const READING_EXPERIENCE_STATUSES: ReadingStatus[] = [
  "reading",
  "paused",
  "finished",
  "dnf",
  "rereading",
];
const AVERAGE_RATING_FRACTION_DIGITS = 2;

const GenreAggregateRowSchema = z.object({
  averageRating: z.number().nullable(),
  booksCount: z.number().int(),
  groupKey: z.string(),
  groupName: z.string(),
  key: z.string(),
  label: z.string(),
  normalizedName: z.string(),
  ratedBooksCount: z.number().int(),
  readCount: z.number().int(),
  readingQueueCount: z.number().int(),
  sortOrder: z.number().int(),
  wantToBuyCount: z.number().int(),
});

const GenreCoverRowSchema = z.object({ coverMediaId: z.string(), genreKey: z.string() });

const GenreLibraryCountsRowSchema = z.object({
  booksWithGenresCount: z.number().int(),
  finishedBooksCount: z.number().int(),
  finishedBooksWithGenresCount: z.number().int(),
  libraryBooksCount: z.number().int(),
  queuedBooksCount: z.number().int(),
  queuedBooksWithGenresCount: z.number().int(),
  ratedBooksCount: z.number().int(),
  ratedBooksWithGenresCount: z.number().int(),
  wantToBuyBooksCount: z.number().int(),
  wantToBuyBooksWithGenresCount: z.number().int(),
});

const GenreOverviewRowSchema = z.object({
  booksCount: z.number().int(),
  firstAddedAt: z.date(),
  key: z.string(),
  label: z.string(),
  lastReadingActivityAt: z.date().nullable(),
  latestUnratedFinishedAt: z.date().nullable(),
  normalizedName: z.string(),
  readCount: z.number().int(),
  startedBooksCount: z.number().int(),
  unratedFinishedCount: z.number().int(),
});

@Injectable()
export class GenreStatsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async aggregateGenreOverview(userId: string): Promise<GenreOverviewAggregate[]> {
    const rows = await this.prisma.$queryRaw(Prisma.sql`
      WITH cycle_activity AS (
        SELECT
          cycle.book_id,
          max(greatest(cycle.started_at, cycle.finished_at, cycle.ended_at)) AS last_activity
        FROM book_reading_cycles cycle
        WHERE cycle.user_id = ${userId}::uuid
        GROUP BY cycle.book_id
      ),
      book_activity AS (
        SELECT
          book.genres,
          book.reading_status,
          book.created_at,
          progress.rating,
          progress.finished_at,
          greatest(
            progress.started_at,
            progress.finished_at,
            progress.paused_at,
            progress.abandoned_at,
            progress.last_progress_update_at,
            cycle_activity.last_activity
          ) AS last_activity
        FROM books book
        LEFT JOIN book_reading_progress progress ON progress.book_id = book.id
        LEFT JOIN cycle_activity ON cycle_activity.book_id = book.id
        WHERE book.user_id = ${userId}::uuid
          AND book.deleted_at IS NULL
      )
      SELECT
        genre.key AS "key",
        genre.name AS "label",
        genre.normalized_name AS "normalizedName",
        count(*)::int AS "booksCount",
        (count(*) FILTER (WHERE activity.reading_status = ${READ_STATUS}))::int AS "readCount",
        (count(*) FILTER (
          WHERE activity.reading_status IN (${Prisma.join(READING_EXPERIENCE_STATUSES)})
        ))::int AS "startedBooksCount",
        min(activity.created_at) AS "firstAddedAt",
        max(activity.last_activity) AS "lastReadingActivityAt",
        (count(*) FILTER (
          WHERE activity.reading_status = ${READ_STATUS} AND activity.rating IS NULL
        ))::int AS "unratedFinishedCount",
        (max(activity.finished_at) FILTER (
          WHERE activity.reading_status = ${READ_STATUS} AND activity.rating IS NULL
        )) AS "latestUnratedFinishedAt"
      FROM book_activity activity
      CROSS JOIN unnest(activity.genres) AS book_genre(key)
      JOIN genres genre ON genre.key = book_genre.key AND genre.user_id IS NULL
      GROUP BY genre.id
    `);
    return z.array(GenreOverviewRowSchema).parse(rows);
  }

  async aggregateGenres(userId: string): Promise<GenreAggregate[]> {
    const rows = await this.prisma.$queryRaw(Prisma.sql`
      SELECT
        genre.key AS "key",
        genre.name AS "label",
        genre.normalized_name AS "normalizedName",
        genre.group_key AS "groupKey",
        genre.group_name AS "groupName",
        genre.sort_order AS "sortOrder",
        count(*)::int AS "booksCount",
        (count(*) FILTER (WHERE book.reading_status = ${READ_STATUS}))::int AS "readCount",
        (count(*) FILTER (WHERE book.queue_position IS NOT NULL))::int AS "readingQueueCount",
        (count(*) FILTER (WHERE book.ownership_status = ${WANT_TO_BUY_STATUS}))::int AS "wantToBuyCount",
        round(avg(progress.rating)::numeric, ${AVERAGE_RATING_FRACTION_DIGITS})::float8 AS "averageRating",
        count(progress.rating)::int AS "ratedBooksCount"
      FROM books book
      CROSS JOIN unnest(book.genres) AS book_genre(key)
      JOIN genres genre ON genre.key = book_genre.key AND genre.user_id IS NULL
      LEFT JOIN book_reading_progress progress ON progress.book_id = book.id
      WHERE book.user_id = ${userId}::uuid
        AND book.deleted_at IS NULL
      GROUP BY genre.id
    `);
    return z.array(GenreAggregateRowSchema).parse(rows);
  }

  async countLibraryBooks(userId: string): Promise<GenreLibraryCounts> {
    const rows = await this.prisma.$queryRaw(Prisma.sql`
      WITH library_book AS (
        SELECT
          book.reading_status,
          book.ownership_status,
          book.queue_position,
          progress.rating,
          EXISTS (
            SELECT 1
            FROM genres genre
            WHERE genre.user_id IS NULL AND genre.key = ANY(book.genres)
          ) AS has_genre
        FROM books book
        LEFT JOIN book_reading_progress progress ON progress.book_id = book.id
        WHERE book.user_id = ${userId}::uuid
          AND book.deleted_at IS NULL
      )
      SELECT
        count(*)::int AS "libraryBooksCount",
        (count(*) FILTER (WHERE has_genre))::int AS "booksWithGenresCount",
        (count(*) FILTER (WHERE rating IS NOT NULL))::int AS "ratedBooksCount",
        (count(*) FILTER (WHERE rating IS NOT NULL AND has_genre))::int AS "ratedBooksWithGenresCount",
        (count(*) FILTER (WHERE reading_status = ${READ_STATUS}))::int AS "finishedBooksCount",
        (count(*) FILTER (
          WHERE reading_status = ${READ_STATUS} AND has_genre
        ))::int AS "finishedBooksWithGenresCount",
        (count(*) FILTER (WHERE queue_position IS NOT NULL))::int AS "queuedBooksCount",
        (count(*) FILTER (
          WHERE queue_position IS NOT NULL AND has_genre
        ))::int AS "queuedBooksWithGenresCount",
        (count(*) FILTER (WHERE ownership_status = ${WANT_TO_BUY_STATUS}))::int AS "wantToBuyBooksCount",
        (count(*) FILTER (
          WHERE ownership_status = ${WANT_TO_BUY_STATUS} AND has_genre
        ))::int AS "wantToBuyBooksWithGenresCount"
      FROM library_book
    `);
    const [counts] = z.tuple([GenreLibraryCountsRowSchema]).parse(rows);
    return counts;
  }

  async listCoverPreviews({
    keys,
    limitPerGenre,
    userId,
  }: {
    keys: string[];
    limitPerGenre: number;
    userId: string;
  }): Promise<GenreCoverPreviewRow[]> {
    if (keys.length === 0) {
      return [];
    }
    const rows = await this.prisma.$queryRaw(Prisma.sql`
      SELECT page_genre.key AS "genreKey", covered.cover_media_id::text AS "coverMediaId"
      FROM unnest(${keys}::text[]) WITH ORDINALITY AS page_genre(key, position)
      CROSS JOIN LATERAL (
        SELECT book.cover_media_id, book.created_at, book.id
        FROM books book
        JOIN media_assets cover ON cover.id = book.cover_media_id
        WHERE book.user_id = ${userId}::uuid
          AND book.deleted_at IS NULL
          AND cover.kind IN (${Prisma.join(MediaKindSchema.options)})
          AND page_genre.key = ANY(book.genres)
        ORDER BY book.created_at DESC, book.id DESC
        LIMIT ${limitPerGenre}
      ) covered
      ORDER BY page_genre.position, covered.created_at DESC, covered.id DESC
    `);
    const coverRows = z.array(GenreCoverRowSchema).parse(rows);
    if (coverRows.length === 0) {
      return [];
    }
    const assets = await this.prisma.mediaAsset.findMany({
      where: { id: { in: [...new Set(coverRows.map((row) => row.coverMediaId))] } },
    });
    const assetById = new Map(assets.map((asset) => [asset.id, asset]));
    return coverRows.flatMap((row) => {
      const coverMedia = assetById.get(row.coverMediaId);
      return coverMedia === undefined ? [] : [{ coverMedia, genreKey: row.genreKey }];
    });
  }
}
