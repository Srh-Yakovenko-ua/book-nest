import type { Nullable, ReadingStatus } from "@app/shared";

import { OwnershipStatusSchema, ReadingStatusSchema } from "@app/shared";
import { Injectable } from "@nestjs/common";
import { z } from "zod";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { SOFT_DELETE_SCOPE } from "../../../core/database/soft-delete.js";
import { Prisma } from "../../../generated/prisma/client.js";

export type CancelledBookStateRow = z.infer<typeof CancelledBookStateRowSchema>;

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

const previewRelations = { include: { coverMedia: true } } satisfies Prisma.BookDefaultArgs;

const CancelledBookStateRowSchema = z.object({
  cancelledAt: z.date(),
  cancelReason: z.string().nullable(),
  hasActiveOrder: z.boolean(),
  hasReceivedOrder: z.boolean(),
  id: z.uuid(),
  inQueue: z.boolean(),
  ownershipStatus: OwnershipStatusSchema,
  seriesId: z.uuid().nullable(),
});

@Injectable()
export class CancelledFollowUpRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listCancelledBookStates(
    userId: string,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<CancelledBookStateRow[]> {
    const rows = await client.$queryRaw(Prisma.sql`
      SELECT
        latest.book_id AS "id",
        latest.cancelled_at AS "cancelledAt",
        latest.cancel_reason AS "cancelReason",
        book.ownership_status AS "ownershipStatus",
        (book.queue_position IS NOT NULL) AS "inQueue",
        book.series_id AS "seriesId",
        COALESCE(orders.has_received, false) AS "hasReceivedOrder",
        COALESCE(orders.has_active, false) AS "hasActiveOrder"
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
      LEFT JOIN LATERAL (
        SELECT
          bool_or(other.received_at IS NOT NULL) AS has_received,
          bool_or(other.cancelled_at IS NULL AND other.received_at IS NULL) AS has_active
        FROM book_order_items other
        JOIN book_orders other_order ON other_order.id = other.order_id
        WHERE other.book_id = book.id
          AND other_order.user_id = ${userId}::uuid
      ) orders ON true
      WHERE book.user_id = ${userId}::uuid
        AND book.deleted_at IS NULL
      ORDER BY latest.cancelled_at DESC, book.id ASC
    `);

    return z.array(CancelledBookStateRowSchema).parse(rows);
  }

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
      where: { ...SOFT_DELETE_SCOPE.active, id: { in: bookIds }, userId },
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
}
