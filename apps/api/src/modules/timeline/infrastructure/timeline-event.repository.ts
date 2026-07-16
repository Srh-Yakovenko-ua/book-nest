import type { Nullable, TimelineEventSort } from "@app/shared";

import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { timelineEventsOrderBy } from "../domain/event-sort.js";
import { TIMELINE_POSITION_STEP } from "../domain/sparse-position.js";

const eventViewArgs = {
  include: { timeline: { select: { colorKey: true, name: true } } },
} satisfies Prisma.BookTimelineEventDefaultArgs;

const eventPreviewSelect = {
  select: {
    bookOrder: true,
    chapter: true,
    id: true,
    pageNumber: true,
    timeline: { select: { name: true } },
    timelineId: true,
    title: true,
  },
} satisfies Prisma.BookTimelineEventDefaultArgs;

const eventDetailArgs = {
  include: {
    incomingRelations: {
      select: { id: true, relationType: true, sourceEvent: eventPreviewSelect },
    },
    outgoingRelations: {
      select: { id: true, relationType: true, targetEvent: eventPreviewSelect },
    },
    resolvedBy: eventPreviewSelect,
    resolves: eventPreviewSelect,
    timeline: { select: { colorKey: true, name: true } },
  },
} satisfies Prisma.BookTimelineEventDefaultArgs;

const createdRelationArgs = {
  select: {
    createdAt: true,
    id: true,
    relationType: true,
    sourceEventId: true,
    targetEvent: eventPreviewSelect,
    targetEventId: true,
  },
} satisfies Prisma.BookTimelineEventRelationDefaultArgs;

export type CreatedRelationRow = Prisma.BookTimelineEventRelationGetPayload<
  typeof createdRelationArgs
>;
export type CreateEventData = {
  bookId: string;
  bookOrder: number;
  chapter: Nullable<string>;
  description: Nullable<string>;
  eventType: string;
  importance: string;
  importanceRank: number;
  location: Nullable<string>;
  pageNumber: Nullable<number>;
  personalNote: Nullable<string>;
  resolvedByEventId: Nullable<string>;
  storyTime: Nullable<string>;
  summary: Nullable<string>;
  threadStatus: Nullable<string>;
  timelineId: string;
  timelineOrder: number;
  title: string;
};
export type EventDetailRow = Prisma.BookTimelineEventGetPayload<typeof eventDetailArgs>;
export type EventNeighborRow = {
  bookOrder: number;
  timelineId: string;
  timelineOrder: number;
};

export type EventScalarRow = Prisma.BookTimelineEventGetPayload<Record<string, never>>;

export type EventsFilter = {
  bookId: string;
  currentPage: Nullable<number>;
  eventTypes: string[] | undefined;
  importances: string[] | undefined;
  recap: boolean;
  search: string | undefined;
  timelineId: string | undefined;
  unresolved: boolean;
};

export type EventViewRow = Prisma.BookTimelineEventGetPayload<typeof eventViewArgs>;

export type TimelineOverviewAggregate = {
  byImportance: { count: number; importance: string }[];
  byType: { count: number; eventType: string }[];
  chapterDensity: { chapter: Nullable<string>; count: number }[];
  eventsAfterPosition: number;
  eventsBeforePosition: number;
  eventsUnknownPosition: number;
  totalEvents: number;
  unresolvedCount: number;
};

export type UpdateEventFields = {
  chapter?: Nullable<string>;
  description?: Nullable<string>;
  eventType?: string;
  importance?: string;
  importanceRank?: number;
  location?: Nullable<string>;
  pageNumber?: Nullable<number>;
  personalNote?: Nullable<string>;
  resolvedByEventId?: Nullable<string>;
  storyTime?: Nullable<string>;
  summary?: Nullable<string>;
  threadStatus?: Nullable<string>;
  title?: string;
};

type ListEventsInput = EventsFilter & {
  skip: number;
  sort: TimelineEventSort;
  take: number;
};

@Injectable()
export class TimelineEventRepository {
  constructor(private readonly prisma: PrismaService) {}

  async aggregateOverview({
    bookId,
    currentPage,
  }: {
    bookId: string;
    currentPage: Nullable<number>;
  }): Promise<TimelineOverviewAggregate> {
    const [
      totalEvents,
      unresolvedCount,
      eventsWithoutPage,
      byTypeRows,
      byImportanceRows,
      chapterRows,
    ] = await Promise.all([
      this.prisma.bookTimelineEvent.count({ where: { bookId } }),
      this.prisma.bookTimelineEvent.count({ where: { bookId, threadStatus: "open" } }),
      this.prisma.bookTimelineEvent.count({ where: { bookId, pageNumber: null } }),
      this.prisma.bookTimelineEvent.groupBy({
        _count: { _all: true },
        by: ["eventType"],
        where: { bookId },
      }),
      this.prisma.bookTimelineEvent.groupBy({
        _count: { _all: true },
        by: ["importance"],
        where: { bookId },
      }),
      this.prisma.bookTimelineEvent.groupBy({
        _count: { _all: true },
        by: ["chapter"],
        where: { bookId },
      }),
    ]);

    const positionSplit = await this.splitByPosition({
      bookId,
      currentPage,
      eventsWithoutPage,
      totalEvents,
    });

    return {
      byImportance: byImportanceRows.map((row) => ({
        count: row._count._all,
        importance: row.importance,
      })),
      byType: byTypeRows.map((row) => ({ count: row._count._all, eventType: row.eventType })),
      chapterDensity: chapterRows.map((row) => ({ chapter: row.chapter, count: row._count._all })),
      eventsAfterPosition: positionSplit.after,
      eventsBeforePosition: positionSplit.before,
      eventsUnknownPosition: positionSplit.unknown,
      totalEvents,
      unresolvedCount,
    };
  }

  countEvents(filter: EventsFilter): Promise<number> {
    return this.prisma.bookTimelineEvent.count({ where: buildEventsWhere(filter) });
  }

  countInTimeline(
    timelineId: string,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<number> {
    return client.bookTimelineEvent.count({ where: { timelineId } });
  }

  create(
    data: CreateEventData,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<EventViewRow> {
    return client.bookTimelineEvent.create({ data, ...eventViewArgs });
  }

  createRelation(
    data: { relationType: string; sourceEventId: string; targetEventId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<CreatedRelationRow> {
    return client.bookTimelineEventRelation.create({ data, ...createdRelationArgs });
  }

  async deleteEvent(
    eventId: string,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await client.bookTimelineEvent.delete({ where: { id: eventId } });
  }

  async deleteRelation(relationId: string): Promise<number> {
    const result = await this.prisma.bookTimelineEventRelation.deleteMany({
      where: { id: relationId },
    });
    return result.count;
  }

  findEventInBook(
    { bookId, eventId }: { bookId: string; eventId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<Nullable<{ id: string }>> {
    return client.bookTimelineEvent.findFirst({
      select: { id: true },
      where: { bookId, id: eventId },
    });
  }

  findNeighbor(
    { bookId, eventId }: { bookId: string; eventId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<Nullable<EventNeighborRow>> {
    return client.bookTimelineEvent.findFirst({
      select: { bookOrder: true, timelineId: true, timelineOrder: true },
      where: { bookId, id: eventId },
    });
  }

  findOwnedDetail({
    eventId,
    userId,
  }: {
    eventId: string;
    userId: string;
  }): Promise<Nullable<EventDetailRow>> {
    return this.prisma.bookTimelineEvent.findFirst({
      where: { book: { userId }, id: eventId },
      ...eventDetailArgs,
    });
  }

  findOwnedEvent(
    { eventId, userId }: { eventId: string; userId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<Nullable<EventScalarRow>> {
    return client.bookTimelineEvent.findFirst({ where: { book: { userId }, id: eventId } });
  }

  findOwnedRelation({
    relationId,
    userId,
  }: {
    relationId: string;
    userId: string;
  }): Promise<Nullable<{ id: string }>> {
    return this.prisma.bookTimelineEventRelation.findFirst({
      select: { id: true },
      where: { id: relationId, sourceEvent: { book: { userId } } },
    });
  }

  async findTimelineOrderInTimeline(
    { eventId, timelineId }: { eventId: string; timelineId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<Nullable<number>> {
    const neighbor = await client.bookTimelineEvent.findFirst({
      select: { timelineOrder: true },
      where: { id: eventId, timelineId },
    });
    return neighbor?.timelineOrder ?? null;
  }

  listEvents({ skip, sort, take, ...filter }: ListEventsInput): Promise<EventViewRow[]> {
    return this.prisma.bookTimelineEvent.findMany({
      orderBy: timelineEventsOrderBy(sort),
      skip,
      take,
      where: buildEventsWhere(filter),
      ...eventViewArgs,
    });
  }

  async maxBookOrder(
    bookId: string,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<Nullable<number>> {
    const aggregate = await client.bookTimelineEvent.aggregate({
      _max: { bookOrder: true },
      where: { bookId },
    });
    return aggregate._max.bookOrder;
  }

  async maxTimelineOrder(
    timelineId: string,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<Nullable<number>> {
    const aggregate = await client.bookTimelineEvent.aggregate({
      _max: { timelineOrder: true },
      where: { timelineId },
    });
    return aggregate._max.timelineOrder;
  }

  async moveAllEvents(
    {
      baseOrder,
      fromTimelineId,
      toTimelineId,
    }: {
      baseOrder: number;
      fromTimelineId: string;
      toTimelineId: string;
    },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await client.$executeRaw`
      WITH ordered AS (
        SELECT id, row_number() OVER (ORDER BY timeline_order, id) AS rn
        FROM book_timeline_events
        WHERE timeline_id = ${fromTimelineId}::uuid
      )
      UPDATE book_timeline_events target
      SET timeline_id = ${toTimelineId}::uuid,
          timeline_order = (${baseOrder} + ordered.rn * ${TIMELINE_POSITION_STEP})::int
      FROM ordered
      WHERE target.id = ordered.id
    `;
  }

  moveEvent(
    {
      eventId,
      timelineId,
      timelineOrder,
    }: {
      eventId: string;
      timelineId: string;
      timelineOrder: number;
    },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<EventViewRow> {
    return client.bookTimelineEvent.update({
      data: { timelineId, timelineOrder },
      where: { id: eventId },
      ...eventViewArgs,
    });
  }

  async rebalanceBookOrder(
    bookId: string,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await client.$executeRaw`
      WITH ordered AS (
        SELECT id, row_number() OVER (ORDER BY book_order, id) AS rn
        FROM book_timeline_events
        WHERE book_id = ${bookId}::uuid
      )
      UPDATE book_timeline_events target
      SET book_order = (-ordered.rn)::int
      FROM ordered
      WHERE target.id = ordered.id
    `;
    await client.$executeRaw`
      UPDATE book_timeline_events
      SET book_order = ((-book_order) * ${TIMELINE_POSITION_STEP})::int
      WHERE book_id = ${bookId}::uuid
    `;
  }

  async rebalanceTimelineOrder(
    timelineId: string,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await client.$executeRaw`
      WITH ordered AS (
        SELECT id, row_number() OVER (ORDER BY timeline_order, id) AS rn
        FROM book_timeline_events
        WHERE timeline_id = ${timelineId}::uuid
      )
      UPDATE book_timeline_events target
      SET timeline_order = (-ordered.rn)::int
      FROM ordered
      WHERE target.id = ordered.id
    `;
    await client.$executeRaw`
      UPDATE book_timeline_events
      SET timeline_order = ((-timeline_order) * ${TIMELINE_POSITION_STEP})::int
      WHERE timeline_id = ${timelineId}::uuid
    `;
  }

  relationExists({
    relationType,
    sourceEventId,
    targetEventId,
  }: {
    relationType: string;
    sourceEventId: string;
    targetEventId: string;
  }): Promise<Nullable<{ id: string }>> {
    return this.prisma.bookTimelineEventRelation.findFirst({
      select: { id: true },
      where: { relationType, sourceEventId, targetEventId },
    });
  }

  setBookOrder(
    { bookOrder, eventId }: { bookOrder: number; eventId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<EventViewRow> {
    return client.bookTimelineEvent.update({
      data: { bookOrder },
      where: { id: eventId },
      ...eventViewArgs,
    });
  }

  setTimelineOrder(
    { eventId, timelineOrder }: { eventId: string; timelineOrder: number },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<EventViewRow> {
    return client.bookTimelineEvent.update({
      data: { timelineOrder },
      where: { id: eventId },
      ...eventViewArgs,
    });
  }

  update(
    { eventId, fields }: { eventId: string; fields: UpdateEventFields },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<EventViewRow> {
    return client.bookTimelineEvent.update({
      data: fields,
      where: { id: eventId },
      ...eventViewArgs,
    });
  }

  private async splitByPosition({
    bookId,
    currentPage,
    eventsWithoutPage,
    totalEvents,
  }: {
    bookId: string;
    currentPage: Nullable<number>;
    eventsWithoutPage: number;
    totalEvents: number;
  }): Promise<{ after: number; before: number; unknown: number }> {
    if (currentPage === null) {
      return { after: 0, before: 0, unknown: totalEvents };
    }
    const [before, after] = await Promise.all([
      this.prisma.bookTimelineEvent.count({
        where: { bookId, pageNumber: { lte: currentPage } },
      }),
      this.prisma.bookTimelineEvent.count({
        where: { bookId, pageNumber: { gt: currentPage } },
      }),
    ]);
    return { after, before, unknown: eventsWithoutPage };
  }
}

function buildEventsWhere(filter: EventsFilter): Prisma.BookTimelineEventWhereInput {
  const where: Prisma.BookTimelineEventWhereInput = { bookId: filter.bookId };
  const and: Prisma.BookTimelineEventWhereInput[] = [];

  if (filter.timelineId !== undefined) {
    where.timelineId = filter.timelineId;
  }
  if (filter.eventTypes !== undefined) {
    where.eventType = { in: filter.eventTypes };
  }
  if (filter.importances !== undefined) {
    where.importance = { in: filter.importances };
  }
  if (filter.unresolved) {
    where.threadStatus = "open";
  }
  if (filter.recap && filter.currentPage !== null) {
    and.push({ OR: [{ pageNumber: { lte: filter.currentPage } }, { pageNumber: null }] });
  }
  if (filter.search !== undefined) {
    and.push({ OR: buildSearchConditions(filter.search) });
  }
  if (and.length > 0) {
    where.AND = and;
  }

  return where;
}

function buildSearchConditions(search: string): Prisma.BookTimelineEventWhereInput[] {
  const contains = { contains: search, mode: "insensitive" } as const;
  return [
    { title: contains },
    { summary: contains },
    { description: contains },
    { chapter: contains },
    { location: contains },
    { timeline: { name: contains } },
  ];
}
