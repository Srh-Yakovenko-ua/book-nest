import type { Nullable, ReadingStatus } from "@app/shared";

import { ReadingStatusSchema } from "@app/shared";
import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";

import { acquireAdvisoryLock, ADVISORY_LOCK_CLASS } from "../../../core/database/advisory-lock.js";
import { PrismaService } from "../../../core/database/prisma.service.js";
import { TIMELINE_POSITION_STEP } from "../domain/sparse-position.js";
import { DEFAULT_TIMELINE_NAME } from "../domain/timeline-fields.js";

const timelineWithCountArgs = {
  include: { _count: { select: { events: true } } },
} satisfies Prisma.BookTimelineDefaultArgs;

export type BookReadingContext = {
  currentPage: Nullable<number>;
  pagesCount: Nullable<number>;
  readingStatus: ReadingStatus;
};

export type CreateTimelineData = {
  bookId: string;
  colorKey: Nullable<string>;
  description: Nullable<string>;
  isDefault: boolean;
  name: string;
  position: number;
};

export type TimelineRow = Prisma.BookTimelineGetPayload<Record<string, never>>;

export type TimelineWithCount = Prisma.BookTimelineGetPayload<typeof timelineWithCountArgs>;

export type UpdateTimelineFields = {
  colorKey?: Nullable<string>;
  description?: Nullable<string>;
  name?: string;
};

@Injectable()
export class TimelineRepository {
  constructor(private readonly prisma: PrismaService) {}

  async acquireBookLock(
    bookId: string,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await acquireAdvisoryLock({ classId: ADVISORY_LOCK_CLASS.timeline, key: bookId }, client);
  }

  countTimelines(bookId: string, client: Prisma.TransactionClient = this.prisma): Promise<number> {
    return client.bookTimeline.count({ where: { bookId } });
  }

  create(
    data: CreateTimelineData,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<TimelineRow> {
    return client.bookTimeline.create({ data });
  }

  async deleteTimeline(
    timelineId: string,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await client.bookTimeline.delete({ where: { id: timelineId } });
  }

  async ensureDefault(
    bookId: string,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    const count = await client.bookTimeline.count({ where: { bookId } });
    if (count > 0) {
      return;
    }
    await client.bookTimeline.create({
      data: {
        bookId,
        colorKey: null,
        description: null,
        isDefault: true,
        name: DEFAULT_TIMELINE_NAME,
        position: TIMELINE_POSITION_STEP,
      },
    });
  }

  async findBookContext(
    { bookId, userId }: { bookId: string; userId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<Nullable<BookReadingContext>> {
    const book = await client.book.findFirst({
      select: {
        pagesCount: true,
        readingProgress: { select: { currentPage: true } },
        readingStatus: true,
      },
      where: { id: bookId, userId },
    });
    if (book === null) {
      return null;
    }
    return {
      currentPage: book.readingProgress?.currentPage ?? null,
      pagesCount: book.pagesCount,
      readingStatus: ReadingStatusSchema.parse(book.readingStatus),
    };
  }

  findDefaultTimeline(
    bookId: string,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<Nullable<TimelineRow>> {
    return client.bookTimeline.findFirst({ where: { bookId, isDefault: true } });
  }

  findOwnedTimeline(
    { timelineId, userId }: { timelineId: string; userId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<Nullable<TimelineRow>> {
    return client.bookTimeline.findFirst({ where: { book: { userId }, id: timelineId } });
  }

  findTimelineInBook(
    { bookId, timelineId }: { bookId: string; timelineId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<Nullable<TimelineRow>> {
    return client.bookTimeline.findFirst({ where: { bookId, id: timelineId } });
  }

  listWithCounts(bookId: string): Promise<TimelineWithCount[]> {
    return this.prisma.bookTimeline.findMany({
      orderBy: [{ position: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      where: { bookId },
      ...timelineWithCountArgs,
    });
  }

  async maxPosition(
    bookId: string,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<Nullable<number>> {
    const aggregate = await client.bookTimeline.aggregate({
      _max: { position: true },
      where: { bookId },
    });
    return aggregate._max.position;
  }

  async rebalancePositions(
    bookId: string,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await client.$executeRaw`
      WITH ordered AS (
        SELECT id, row_number() OVER (ORDER BY position, id) AS rn
        FROM book_timelines
        WHERE book_id = ${bookId}::uuid
      )
      UPDATE book_timelines target
      SET position = (ordered.rn * ${TIMELINE_POSITION_STEP})::int
      FROM ordered
      WHERE target.id = ordered.id
    `;
  }

  async setDefault(
    { bookId, timelineId }: { bookId: string; timelineId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await client.bookTimeline.updateMany({
      data: { isDefault: false },
      where: { bookId, isDefault: true },
    });
    await client.bookTimeline.update({
      data: { isDefault: true },
      where: { id: timelineId },
    });
  }

  async setPosition(
    { position, timelineId }: { position: number; timelineId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await client.bookTimeline.update({ data: { position }, where: { id: timelineId } });
  }

  update(
    { fields, timelineId }: { fields: UpdateTimelineFields; timelineId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<TimelineRow> {
    return client.bookTimeline.update({ data: fields, where: { id: timelineId } });
  }
}
