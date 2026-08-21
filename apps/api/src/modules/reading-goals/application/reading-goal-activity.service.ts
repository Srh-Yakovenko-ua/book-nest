import {
  type Nullable,
  type ReadingGoalActivityQuery,
  type ReadingGoalActivityResponse,
  ReadingGoalActivityTypeSchema,
  type ReadingGoalActivityView,
} from "@app/shared";
import { Injectable } from "@nestjs/common";
import { parseISO } from "date-fns";
import { z } from "zod";

import type { ReadingGoalActivityModel } from "../../../generated/prisma/models.js";

import { NotFoundError } from "../../../core/exceptions/errors.js";
import { createLogger } from "../../../core/logger.js";
import { READING_GOAL_MESSAGE } from "../domain/reading-goal.constants.js";
import { ReadingGoalActivityRepository } from "../infrastructure/reading-goal-activity.repository.js";
import { ReadingGoalBooksRepository } from "../infrastructure/reading-goal-books.repository.js";
import { ReadingGoalsRepository } from "../infrastructure/reading-goals.repository.js";
import { readingGoalCursorCodec } from "./reading-goal-books.service.js";

const log = createLogger("reading-goals.activity");

const ReadingGoalActivityCursorSchema = z.object({
  createdAt: z.iso.datetime().transform((value) => parseISO(value)),
  id: z.uuid(),
});

const ReadingGoalActivityMetadataSchema = z.record(z.string(), z.unknown()).nullable().catch(null);

type ActivityBookTitles = ReadonlyMap<string, string>;

type ListReadingGoalActivityInput = {
  goalId: string;
  query: ReadingGoalActivityQuery;
  userId: string;
};

@Injectable()
export class ReadingGoalActivityService {
  constructor(
    private readonly readingGoalActivityRepository: ReadingGoalActivityRepository,
    private readonly readingGoalBooksRepository: ReadingGoalBooksRepository,
    private readonly readingGoalsRepository: ReadingGoalsRepository,
  ) {}

  async list({
    goalId,
    query,
    userId,
  }: ListReadingGoalActivityInput): Promise<ReadingGoalActivityResponse> {
    const goal = await this.readingGoalsRepository.findOwnedById({ goalId, userId });
    if (goal === null) {
      throw new NotFoundError(READING_GOAL_MESSAGE.notFound);
    }

    const rows = await this.readingGoalActivityRepository.findPage({
      cursor: readingGoalCursorCodec.decode({
        schema: ReadingGoalActivityCursorSchema,
        value: query.cursor,
      }),
      goalId,
      limit: query.limit + 1,
      type: query.type ?? null,
    });
    const hasMore = rows.length > query.limit;
    const pageRows = hasMore ? rows.slice(0, query.limit) : rows;
    const titles = await this.loadBookTitles({ goalId, rows: pageRows });
    const lastRow = pageRows.at(-1);

    return {
      items: pageRows.flatMap((row) => toActivityView({ row, titles })),
      nextCursor: hasMore && lastRow !== undefined ? encodeActivityCursor(lastRow) : null,
    };
  }

  async preview({
    goalId,
    limit,
  }: {
    goalId: string;
    limit: number;
  }): Promise<ReadingGoalActivityView[]> {
    const rows = await this.readingGoalActivityRepository.findLatest({ goalId, limit });
    const titles = await this.loadBookTitles({ goalId, rows });
    return rows.flatMap((row) => toActivityView({ row, titles }));
  }

  private async loadBookTitles({
    goalId,
    rows,
  }: {
    goalId: string;
    rows: ReadingGoalActivityModel[];
  }): Promise<ActivityBookTitles> {
    const bookIds = new Set(rows.flatMap((row) => (row.bookId === null ? [] : [row.bookId])));
    const titles = new Map<string, string>();
    if (bookIds.size === 0) {
      return titles;
    }

    const snapshot = await this.readingGoalBooksRepository.findSnapshotBooks({ goalId });
    for (const entry of snapshot) {
      if (bookIds.has(entry.bookId)) {
        titles.set(entry.bookId, entry.book.title);
      }
    }
    return titles;
  }
}

function encodeActivityCursor(row: ReadingGoalActivityModel): string {
  return readingGoalCursorCodec.encode({
    createdAt: row.createdAt.toISOString(),
    id: row.id,
  });
}

function toActivityBook({
  bookId,
  titles,
}: {
  bookId: Nullable<string>;
  titles: ActivityBookTitles;
}): ReadingGoalActivityView["book"] {
  if (bookId === null) {
    return null;
  }
  const title = titles.get(bookId);
  return title === undefined ? null : { id: bookId, title };
}

function toActivityView({
  row,
  titles,
}: {
  row: ReadingGoalActivityModel;
  titles: ActivityBookTitles;
}): ReadingGoalActivityView[] {
  const type = ReadingGoalActivityTypeSchema.safeParse(row.type);
  if (!type.success) {
    log.warn(
      { activityId: row.id, type: row.type },
      "dropped a reading goal activity row with an unknown type",
    );
    return [];
  }

  return [
    {
      book: toActivityBook({ bookId: row.bookId, titles }),
      createdAt: row.createdAt.toISOString(),
      id: row.id,
      metadata: ReadingGoalActivityMetadataSchema.parse(row.metadata),
      type: type.data,
    },
  ];
}
