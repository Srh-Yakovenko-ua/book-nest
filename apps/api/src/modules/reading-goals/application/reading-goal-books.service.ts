import {
  type Nullable,
  OwnershipStatusSchema,
  type ReadingGoalBookScope,
  type ReadingGoalBooksQuery,
  type ReadingGoalBooksResponse,
  type ReadingGoalBookView,
  ReadingStatusSchema,
} from "@app/shared";
import { Injectable } from "@nestjs/common";
import { compareAsc } from "date-fns";
import { z } from "zod";

import type { ReadingGoalSnapshotBook } from "../domain/reading-goal-metrics.js";
import type { ReadingGoalSnapshotBookRow } from "../infrastructure/reading-goal-books.repository.js";

import { assertNever } from "../../../core/assert-never.js";
import { BadRequestError, NotFoundError } from "../../../core/exceptions/errors.js";
import { parseIsoDate, toNullableIsoDate } from "../../../core/iso-date.js";
import { MediaService } from "../../media/index.js";
import { READING_GOAL_MESSAGE } from "../domain/reading-goal.constants.js";
import { ReadingGoalBooksRepository } from "../infrastructure/reading-goal-books.repository.js";
import { ReadingGoalsRepository } from "../infrastructure/reading-goals.repository.js";

const READING_GOAL_CURSOR_MESSAGE = "Invalid pagination cursor";

const READING_GOAL_BOOK_GROUP = Object.freeze({ counted: 0, remaining: 1 });

const ReadingGoalBookCursorSchema = z.object({
  bookId: z.uuid(),
  position: z.number().int(),
  qualifiedFinishedAt: z.iso
    .date()
    .transform((value) => parseIsoDate(value))
    .nullable(),
  reading: z.boolean(),
});

export type ReadingGoalSnapshotPreview = {
  countedBooks: ReadingGoalBookView[];
  remainingBooks: ReadingGoalBookView[];
  snapshotBookCount: number;
  snapshotBooks: ReadingGoalSnapshotBook[];
};

type ListReadingGoalBooksInput = {
  goalId: string;
  query: ReadingGoalBooksQuery;
  userId: string;
};

type ReadingGoalBookEntry = {
  key: ReadingGoalBookSortKey;
  view: ReadingGoalBookView;
};

type ReadingGoalBookSortKey = z.infer<typeof ReadingGoalBookCursorSchema>;

type ReadingGoalCursorPayload = Record<string, Nullable<boolean | number | string>>;

export const readingGoalCursorCodec = {
  decode<TSchema extends z.ZodType>({
    schema,
    value,
  }: {
    schema: TSchema;
    value: string | undefined;
  }): Nullable<z.infer<TSchema>> {
    if (value === undefined) {
      return null;
    }
    const parsed = schema.safeParse(readCursorPayload(value));
    if (!parsed.success) {
      throw new BadRequestError(READING_GOAL_CURSOR_MESSAGE);
    }
    return parsed.data;
  },

  encode(payload: ReadingGoalCursorPayload): string {
    return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  },
};

@Injectable()
export class ReadingGoalBooksService {
  constructor(
    private readonly mediaService: MediaService,
    private readonly readingGoalBooksRepository: ReadingGoalBooksRepository,
    private readonly readingGoalsRepository: ReadingGoalsRepository,
  ) {}

  async list({
    goalId,
    query,
    userId,
  }: ListReadingGoalBooksInput): Promise<ReadingGoalBooksResponse> {
    const goal = await this.readingGoalsRepository.findOwnedById({ goalId, userId });
    if (goal === null) {
      throw new NotFoundError(READING_GOAL_MESSAGE.notFound);
    }

    const rows = await this.readingGoalBooksRepository.findSnapshotBooks({ goalId });
    const entries = rows
      .filter((row) => matchesScope({ row, scope: query.scope }))
      .map((row) => this.toEntry(row))
      .sort((left, right) => compareReadingGoalBooks(left.key, right.key));

    const remaining = selectAfterCursor({
      cursor: readingGoalCursorCodec.decode({
        schema: ReadingGoalBookCursorSchema,
        value: query.cursor,
      }),
      entries,
    });
    const hasMore = remaining.length > query.limit;
    const page = hasMore ? remaining.slice(0, query.limit) : remaining;
    const lastEntry = page.at(-1);

    return {
      items: page.map((entry) => entry.view),
      nextCursor: hasMore && lastEntry !== undefined ? encodeBookCursor(lastEntry.key) : null,
    };
  }

  async preview({
    goalId,
    limit,
  }: {
    goalId: string;
    limit: number;
  }): Promise<ReadingGoalSnapshotPreview> {
    const rows = await this.readingGoalBooksRepository.findSnapshotBooks({ goalId });
    const entries = rows
      .map((row) => this.toEntry(row))
      .sort((left, right) => compareReadingGoalBooks(left.key, right.key));
    return {
      countedBooks: takeViews({ entries, limit, qualifying: true }),
      remainingBooks: takeViews({ entries, limit, qualifying: false }),
      snapshotBookCount: rows.length,
      snapshotBooks: rows.map((row) => ({
        bookId: row.bookId,
        qualifiedFinishedAt: row.qualifiedFinishedAt,
      })),
    };
  }

  private toEntry(row: ReadingGoalSnapshotBookRow): ReadingGoalBookEntry {
    const { book } = row;
    const readingStatus = ReadingStatusSchema.parse(book.readingStatus);
    return {
      key: {
        bookId: row.bookId,
        position: row.position,
        qualifiedFinishedAt: row.qualifiedFinishedAt,
        reading: readingStatus === "reading",
      },
      view: {
        authors: book.authors.map((link) => ({ id: link.author.id, name: link.author.name })),
        countedFinishedAt: toNullableIsoDate(row.qualifiedFinishedAt),
        cover: this.mediaService.buildViewOrNull(book.coverMedia),
        id: row.bookId,
        ownershipStatus: OwnershipStatusSchema.parse(book.ownershipStatus),
        qualifies: row.qualifiedFinishedAt !== null,
        reading: {
          currentPage: book.readingProgress?.currentPage ?? null,
          finishedAt: toNullableIsoDate(book.readingProgress?.finishedAt ?? null),
          pagesCount: book.pagesCount,
          startedAt: toNullableIsoDate(book.readingProgress?.startedAt ?? null),
          status: readingStatus,
        },
        snapshotPosition: row.position,
        title: book.title,
      },
    };
  }
}

function compareReadingGoalBooks(
  left: ReadingGoalBookSortKey,
  right: ReadingGoalBookSortKey,
): number {
  const byGroup = groupRank(left) - groupRank(right);
  if (byGroup !== 0) {
    return byGroup;
  }
  if (left.qualifiedFinishedAt !== null && right.qualifiedFinishedAt !== null) {
    const byFinishedAt = compareAsc(left.qualifiedFinishedAt, right.qualifiedFinishedAt);
    return byFinishedAt === 0 ? left.bookId.localeCompare(right.bookId) : byFinishedAt;
  }
  const byReading = Number(right.reading) - Number(left.reading);
  if (byReading !== 0) {
    return byReading;
  }
  const byPosition = left.position - right.position;
  return byPosition === 0 ? left.bookId.localeCompare(right.bookId) : byPosition;
}

function encodeBookCursor(key: ReadingGoalBookSortKey): string {
  return readingGoalCursorCodec.encode({
    bookId: key.bookId,
    position: key.position,
    qualifiedFinishedAt: toNullableIsoDate(key.qualifiedFinishedAt),
    reading: key.reading,
  });
}

function groupRank({ qualifiedFinishedAt }: ReadingGoalBookSortKey): number {
  return qualifiedFinishedAt === null
    ? READING_GOAL_BOOK_GROUP.remaining
    : READING_GOAL_BOOK_GROUP.counted;
}

function matchesScope({
  row,
  scope,
}: {
  row: ReadingGoalSnapshotBookRow;
  scope: ReadingGoalBookScope;
}): boolean {
  switch (scope) {
    case "all":
      return true;
    case "counted":
      return row.qualifiedFinishedAt !== null;
    case "remaining":
      return row.qualifiedFinishedAt === null;
    default:
      return assertNever(scope);
  }
}

function readCursorPayload(value: string): unknown {
  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

function selectAfterCursor({
  cursor,
  entries,
}: {
  cursor: Nullable<ReadingGoalBookSortKey>;
  entries: ReadingGoalBookEntry[];
}): ReadingGoalBookEntry[] {
  if (cursor === null) {
    return entries;
  }
  return entries.filter((entry) => compareReadingGoalBooks(entry.key, cursor) > 0);
}

function takeViews({
  entries,
  limit,
  qualifying,
}: {
  entries: ReadingGoalBookEntry[];
  limit: number;
  qualifying: boolean;
}): ReadingGoalBookView[] {
  return entries
    .filter((entry) => (entry.key.qualifiedFinishedAt !== null) === qualifying)
    .slice(0, limit)
    .map((entry) => entry.view);
}
