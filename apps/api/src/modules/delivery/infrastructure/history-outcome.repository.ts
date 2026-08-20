import { OwnershipStatusSchema, UNREAD_READING_STATUSES } from "@app/shared";
import { Injectable } from "@nestjs/common";
import { z } from "zod";

import type { ReceivedSeriesRow } from "../domain/received-series-insight.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { SOFT_DELETE_SCOPE } from "../../../core/database/soft-delete.js";
import { Prisma } from "../../../generated/prisma/client.js";

export type ReceivedUnreadCounts = {
  booksCount: number;
  inQueueCount: number;
};

export type ReceivedUnreadPreviewRow = Prisma.BookGetPayload<typeof unreadPreviewRelations>;

const unreadPreviewRelations = {
  include: { coverMedia: true },
} satisfies Prisma.BookDefaultArgs;

const UnreadCountsRowSchema = z.object({
  booksCount: z.number().int().nonnegative(),
  inQueueCount: z.number().int().nonnegative(),
});

const UnreadPreviewIdRowSchema = z.object({ id: z.uuid() });

@Injectable()
export class HistoryOutcomeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async hasReceivedBooks(userId: string): Promise<boolean> {
    const received = await this.prisma.bookOrderItem.findFirst({
      select: { id: true },
      where: receivedItemScope(userId),
    });
    return received !== null;
  }

  async listReceivedSeriesRows(userId: string): Promise<ReceivedSeriesRow[]> {
    const rows = await this.prisma.series.findMany({
      orderBy: { id: "asc" },
      select: {
        books: {
          select: {
            orderItems: { select: { id: true }, take: 1, where: receivedItemScope(userId) },
            ownershipStatus: true,
            partNumber: true,
          },
          where: { ...SOFT_DELETE_SCOPE.active, userId },
        },
        id: true,
        totalBooks: true,
      },
      where: {
        ...SOFT_DELETE_SCOPE.active,
        books: {
          some: {
            ...SOFT_DELETE_SCOPE.active,
            orderItems: { some: receivedItemScope(userId) },
            userId,
          },
        },
        userId,
      },
    });

    return rows.map((row) => ({
      books: row.books.map((book) => ({
        isSubject: book.orderItems.length > 0,
        ownershipStatus: OwnershipStatusSchema.parse(book.ownershipStatus),
        partNumber: book.partNumber,
      })),
      id: row.id,
      totalBooks: row.totalBooks,
    }));
  }

  async receivedUnreadCounts(userId: string): Promise<ReceivedUnreadCounts> {
    const rows = await this.prisma.$queryRaw(Prisma.sql`
      SELECT
        (count(*))::int AS "booksCount",
        (count(*) FILTER (WHERE book.queue_position IS NOT NULL))::int AS "inQueueCount"
      ${unreadBooksSource(userId)}
    `);

    return z.array(UnreadCountsRowSchema).parse(rows)[0] ?? { booksCount: 0, inQueueCount: 0 };
  }

  async receivedUnreadPreviews({
    limit,
    userId,
  }: {
    limit: number;
    userId: string;
  }): Promise<ReceivedUnreadPreviewRow[]> {
    const rows = await this.prisma.$queryRaw(Prisma.sql`
      SELECT book.id AS "id"
      ${unreadBooksSource(userId)}
      ORDER BY
        (book.queue_position IS NULL),
        book.queue_position ASC,
        (
          SELECT max(received.received_at)
          FROM book_order_items received
          JOIN book_orders received_order ON received_order.id = received.order_id
          WHERE received.book_id = book.id
            AND received_order.user_id = ${userId}::uuid
            AND received.received_at IS NOT NULL
        ) DESC,
        book.id ASC
      LIMIT ${limit}
    `);

    const orderedIds = z
      .array(UnreadPreviewIdRowSchema)
      .parse(rows)
      .map((row) => row.id);
    if (orderedIds.length === 0) {
      return [];
    }

    const books = await this.prisma.book.findMany({
      where: { id: { in: orderedIds }, userId },
      ...unreadPreviewRelations,
    });
    const byId = new Map(books.map((book) => [book.id, book]));

    return orderedIds.flatMap((id) => {
      const book = byId.get(id);
      return book === undefined ? [] : [book];
    });
  }
}

function receivedItemScope(userId: string): Prisma.BookOrderItemWhereInput {
  return { book: SOFT_DELETE_SCOPE.active, order: { userId }, receivedAt: { not: null } };
}

function unreadBooksSource(userId: string): Prisma.Sql {
  return Prisma.sql`
    FROM books book
    WHERE book.user_id = ${userId}::uuid
      AND book.deleted_at IS NULL
      AND book.reading_status = ANY(${[...UNREAD_READING_STATUSES]}::text[])
      AND EXISTS (
        SELECT 1
        FROM book_order_items received
        JOIN book_orders received_order ON received_order.id = received.order_id
        WHERE received.book_id = book.id
          AND received_order.user_id = ${userId}::uuid
          AND received.received_at IS NOT NULL
      )
  `;
}
