import type { Nullable, ReadingStatus } from "@app/shared";

import { OwnershipStatusSchema, ReadingStatusSchema } from "@app/shared";
import { Injectable } from "@nestjs/common";
import { z } from "zod";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { SOFT_DELETE_SCOPE } from "../../../core/database/soft-delete.js";
import { Prisma } from "../../../generated/prisma/client.js";

export type CancelledFollowUpPreviewRow = Prisma.BookGetPayload<typeof previewRelations>;

export type CancelledSeriesBook = {
  createdAt: Date;
  id: string;
  partNumber: Nullable<number>;
  readingStatus: ReadingStatus;
};

export type CancelledSeriesRow = {
  books: CancelledSeriesBook[];
  id: string;
  totalBooks: Nullable<number>;
};

export type UnresolvedCancelledRow = z.infer<typeof UnresolvedCancelledRowSchema>;

const previewRelations = { include: { coverMedia: true } } satisfies Prisma.BookDefaultArgs;

const UNRESOLVED_OWNERSHIP_STATUS = OwnershipStatusSchema.enum.none;

const UnresolvedCancelledRowSchema = z.object({
  cancelledAt: z.date(),
  cancelReason: z.string().nullable(),
  id: z.uuid(),
  inQueue: z.boolean(),
  seriesId: z.uuid().nullable(),
});

@Injectable()
export class CancelledFollowUpRepository {
  constructor(private readonly prisma: PrismaService) {}

  listPreviews({
    bookIds,
    userId,
  }: {
    bookIds: string[];
    userId: string;
  }): Promise<CancelledFollowUpPreviewRow[]> {
    if (bookIds.length === 0) {
      return Promise.resolve([]);
    }
    return this.prisma.book.findMany({
      where: { id: { in: bookIds }, userId },
      ...previewRelations,
    });
  }

  async listSeriesRows({
    seriesIds,
    userId,
  }: {
    seriesIds: string[];
    userId: string;
  }): Promise<CancelledSeriesRow[]> {
    if (seriesIds.length === 0) {
      return [];
    }

    const rows = await this.prisma.series.findMany({
      orderBy: { id: "asc" },
      select: {
        books: {
          select: { createdAt: true, id: true, partNumber: true, readingStatus: true },
          where: { ...SOFT_DELETE_SCOPE.active, userId },
        },
        id: true,
        totalBooks: true,
      },
      where: { ...SOFT_DELETE_SCOPE.active, id: { in: seriesIds }, userId },
    });

    return rows.map((row) => ({
      books: row.books.map((book) => ({
        createdAt: book.createdAt,
        id: book.id,
        partNumber: book.partNumber,
        readingStatus: ReadingStatusSchema.parse(book.readingStatus),
      })),
      id: row.id,
      totalBooks: row.totalBooks,
    }));
  }

  async listUnresolved(
    userId: string,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<UnresolvedCancelledRow[]> {
    const rows = await client.$queryRaw(Prisma.sql`
      SELECT
        latest.book_id AS "id",
        latest.cancelled_at AS "cancelledAt",
        latest.cancel_reason AS "cancelReason",
        (book.queue_position IS NOT NULL) AS "inQueue",
        book.series_id AS "seriesId"
      FROM (
        SELECT DISTINCT ON (item.book_id)
          item.book_id,
          item.cancelled_at,
          item.cancel_reason
        FROM book_order_items item
        JOIN book_orders ord ON ord.id = item.order_id
        WHERE ord.user_id = ${userId}::uuid
          AND item.cancelled_at IS NOT NULL
        ORDER BY item.book_id, item.cancelled_at DESC, item.id ASC
      ) latest
      JOIN books book ON book.id = latest.book_id
      WHERE book.user_id = ${userId}::uuid
        AND book.deleted_at IS NULL
        AND book.ownership_status = ${UNRESOLVED_OWNERSHIP_STATUS}
        AND NOT EXISTS (
          SELECT 1
          FROM book_order_items other
          JOIN book_orders other_order ON other_order.id = other.order_id
          WHERE other.book_id = book.id
            AND other_order.user_id = ${userId}::uuid
            AND (other.received_at IS NOT NULL OR other.cancelled_at IS NULL)
        )
      ORDER BY latest.cancelled_at DESC, book.id ASC
    `);

    return z.array(UnresolvedCancelledRowSchema).parse(rows);
  }
}
