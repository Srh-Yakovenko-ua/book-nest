import type { Nullable, ReadingStatus } from "@app/shared";

import { ReadingStatusSchema } from "@app/shared";
import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";

import { acquireAdvisoryLock, ADVISORY_LOCK_CLASS } from "../../../core/database/advisory-lock.js";
import { PrismaService } from "../../../core/database/prisma.service.js";
import { SOFT_DELETE_SCOPE } from "../../../core/database/soft-delete.js";
import { TIMELINE_POSITION_STEP } from "../domain/sparse-position.js";
import { DEFAULT_TIMELINE_NAME } from "../domain/timeline-fields.js";

const trashedTimelineSelect = {
  _count: { select: { events: true } },
  book: { select: { title: true } },
  deletedAt: true,
  id: true,
  name: true,
} satisfies Prisma.BookTimelineSelect;

export type TrashedTimelineRow = TrashedTimelineSelection & { deletedAt: Date };

type TrashedTimelineSelection = Prisma.BookTimelineGetPayload<{
  select: typeof trashedTimelineSelect;
}>;

function isTrashedTimeline(row: TrashedTimelineSelection): row is TrashedTimelineRow {
  return row.deletedAt !== null;
}

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
    return client.bookTimeline.count({ where: { ...SOFT_DELETE_SCOPE.active, bookId } });
  }

  countTrashed({ userId }: { userId: string }): Promise<number> {
    return this.prisma.bookTimeline.count({
      where: { ...SOFT_DELETE_SCOPE.trashed, book: { userId } },
    });
  }

  create(
    data: CreateTimelineData,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<TimelineRow> {
    return client.bookTimeline.create({ data });
  }

  async ensureDefault(
    bookId: string,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    const count = await client.bookTimeline.count({
      where: { ...SOFT_DELETE_SCOPE.active, bookId },
    });
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
      where: { ...SOFT_DELETE_SCOPE.active, id: bookId, userId },
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
    return client.bookTimeline.findFirst({
      where: { ...SOFT_DELETE_SCOPE.active, bookId, isDefault: true },
    });
  }

  findForPurge({
    timelineId,
    userId,
  }: {
    timelineId: string;
    userId: string;
  }): Promise<Nullable<{ deletedAt: Nullable<Date> }>> {
    return this.prisma.bookTimeline.findFirst({
      select: { deletedAt: true },
      where: { book: { userId }, id: timelineId },
    });
  }

  findOwnedTimeline(
    { timelineId, userId }: { timelineId: string; userId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<Nullable<TimelineRow>> {
    return client.bookTimeline.findFirst({
      where: {
        ...SOFT_DELETE_SCOPE.active,
        book: { ...SOFT_DELETE_SCOPE.active, userId },
        id: timelineId,
      },
    });
  }

  async findPurgeCandidates({
    deletedBefore,
    limit,
  }: {
    deletedBefore: Date;
    limit: number;
  }): Promise<{ id: string; userId: string }[]> {
    const rows = await this.prisma.bookTimeline.findMany({
      orderBy: { deletedAt: "asc" },
      select: { book: { select: { userId: true } }, id: true },
      take: limit,
      where: { deletedAt: { lt: deletedBefore } },
    });
    return rows.map((row) => ({ id: row.id, userId: row.book.userId }));
  }

  findTimelineInBook(
    { bookId, timelineId }: { bookId: string; timelineId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<Nullable<TimelineRow>> {
    return client.bookTimeline.findFirst({
      where: { ...SOFT_DELETE_SCOPE.active, bookId, id: timelineId },
    });
  }

  async hardDeleteIfTrashed({
    deletedBefore,
    timelineId,
    userId,
  }: {
    deletedBefore: Date;
    timelineId: string;
    userId: string;
  }): Promise<number> {
    const purged = await this.prisma.bookTimeline.deleteMany({
      where: { book: { userId }, deletedAt: { lt: deletedBefore }, id: timelineId },
    });
    return purged.count;
  }

  async listTrashed({
    skip,
    take,
    userId,
  }: {
    skip: number;
    take: number;
    userId: string;
  }): Promise<TrashedTimelineRow[]> {
    const rows = await this.prisma.bookTimeline.findMany({
      orderBy: [{ deletedAt: "desc" }, { id: "asc" }],
      select: trashedTimelineSelect,
      skip,
      take,
      where: { ...SOFT_DELETE_SCOPE.trashed, book: { userId } },
    });
    return rows.filter(isTrashedTimeline);
  }

  listWithCounts(bookId: string): Promise<TimelineWithCount[]> {
    return this.prisma.bookTimeline.findMany({
      orderBy: [{ position: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      where: { ...SOFT_DELETE_SCOPE.active, bookId },
      ...timelineWithCountArgs,
    });
  }

  async maxPosition(
    bookId: string,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<Nullable<number>> {
    const aggregate = await client.bookTimeline.aggregate({
      _max: { position: true },
      where: { ...SOFT_DELETE_SCOPE.active, bookId },
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
        WHERE book_id = ${bookId}::uuid AND deleted_at IS NULL
      )
      UPDATE book_timelines target
      SET position = (ordered.rn * ${TIMELINE_POSITION_STEP})::int
      FROM ordered
      WHERE target.id = ordered.id
    `;
  }

  async restore({ timelineId, userId }: { timelineId: string; userId: string }): Promise<number> {
    const restored = await this.prisma.bookTimeline.updateMany({
      data: { deletedAt: null },
      where: {
        ...SOFT_DELETE_SCOPE.trashed,
        book: { ...SOFT_DELETE_SCOPE.active, userId },
        id: timelineId,
      },
    });
    return restored.count;
  }

  async setDefault(
    { bookId, timelineId }: { bookId: string; timelineId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await client.bookTimeline.updateMany({
      data: { isDefault: false },
      where: { ...SOFT_DELETE_SCOPE.active, bookId, isDefault: true },
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

  async softDelete(
    { deletedAt, timelineId }: { deletedAt: Date; timelineId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<number> {
    const deleted = await client.bookTimeline.updateMany({
      data: { deletedAt },
      where: { ...SOFT_DELETE_SCOPE.active, id: timelineId },
    });
    return deleted.count;
  }

  update(
    { fields, timelineId }: { fields: UpdateTimelineFields; timelineId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<TimelineRow> {
    return client.bookTimeline.update({ data: fields, where: { id: timelineId } });
  }
}
