import type {
  Nullable,
  ReadingGoalListItem,
  ReadingGoalListResponse,
  ReadingGoalSort,
  ReadingGoalsQuery,
} from "@app/shared";

import { ReadingGoalRiskLevelSchema } from "@app/shared";
import { Injectable } from "@nestjs/common";
import { compareAsc, parseISO } from "date-fns";
import { z } from "zod";

import { createLogger } from "../../../core/logger.js";
import { READING_GOAL_LIMITS } from "../domain/reading-goal.constants.js";
import { toReadingGoalListItem } from "../domain/reading-goal.mapper.js";
import { ReadingGoalsRepository } from "../infrastructure/reading-goals.repository.js";
import { readingGoalCursorCodec } from "./reading-goal-books.service.js";
import { ReadingGoalViewBuilder } from "./reading-goal-view.builder.js";

const log = createLogger("reading-goals.catalog");

const ReadingGoalCatalogCursorSchema = z.object({
  createdAt: z.iso.datetime(),
  daysLeft: z.number().int().nullable(),
  deadline: z.iso.date(),
  id: z.uuid(),
  progressPercent: z.number(),
  riskRank: z.number().int().nonnegative(),
});

type ListReadingGoalsInput = {
  query: ReadingGoalsQuery;
  userId: string;
};

type ReadingGoalCatalogKey = z.infer<typeof ReadingGoalCatalogCursorSchema>;

@Injectable()
export class ReadingGoalCatalogService {
  constructor(
    private readonly readingGoalsRepository: ReadingGoalsRepository,
    private readonly viewBuilder: ReadingGoalViewBuilder,
  ) {}

  async list({ query, userId }: ListReadingGoalsInput): Promise<ReadingGoalListResponse> {
    const scanned = await this.readingGoalsRepository.findCatalogPage({
      limit: READING_GOAL_LIMITS.catalogScan + 1,
      listId: query.listId ?? null,
      sort: query.sort,
      userId,
    });
    if (scanned.length > READING_GOAL_LIMITS.catalogScan) {
      log.warn(
        { cap: READING_GOAL_LIMITS.catalogScan, userId },
        "goal catalog truncated at the scan cap",
      );
    }

    const entries = await this.viewBuilder.calculateAll({
      goals: scanned.slice(0, READING_GOAL_LIMITS.catalogScan),
      now: new Date(),
    });
    const ordered = entries
      .map((entry) => toReadingGoalListItem(entry))
      .filter((item) => query.status === undefined || item.status === query.status)
      .sort((left, right) =>
        compareCatalogKeys({
          left: toCatalogKey(left),
          right: toCatalogKey(right),
          sort: query.sort,
        }),
      );

    const remaining = selectAfterCursor({
      cursor: readingGoalCursorCodec.decode({
        schema: ReadingGoalCatalogCursorSchema,
        value: query.cursor,
      }),
      items: ordered,
      sort: query.sort,
    });
    const hasMore = remaining.length > query.limit;
    const items = hasMore ? remaining.slice(0, query.limit) : remaining;
    const lastItem = items.at(-1);

    return {
      items,
      nextCursor:
        hasMore && lastItem !== undefined
          ? readingGoalCursorCodec.encode({ ...toCatalogKey(lastItem) })
          : null,
    };
  }
}

function breakTie({
  ascending,
  left,
  primary,
  right,
}: {
  ascending: boolean;
  left: ReadingGoalCatalogKey;
  primary: number;
  right: ReadingGoalCatalogKey;
}): number {
  if (primary !== 0) {
    return primary;
  }
  const byId = left.id.localeCompare(right.id);
  return ascending ? byId : -byId;
}

function compareByRisk({
  left,
  right,
}: {
  left: ReadingGoalCatalogKey;
  right: ReadingGoalCatalogKey;
}): number {
  const byRisk = right.riskRank - left.riskRank;
  if (byRisk !== 0) {
    return byRisk;
  }
  return breakTie({
    ascending: true,
    left,
    primary: compareNullableAscending(left.daysLeft, right.daysLeft),
    right,
  });
}

function compareCatalogKeys({
  left,
  right,
  sort,
}: {
  left: ReadingGoalCatalogKey;
  right: ReadingGoalCatalogKey;
  sort: ReadingGoalSort;
}): number {
  switch (sort) {
    case "created_asc":
      return breakTie({
        ascending: true,
        left,
        primary: compareIsoAscending(left.createdAt, right.createdAt),
        right,
      });
    case "deadline_asc":
      return breakTie({
        ascending: true,
        left,
        primary: compareIsoAscending(left.deadline, right.deadline),
        right,
      });
    case "deadline_desc":
      return breakTie({
        ascending: false,
        left,
        primary: -compareIsoAscending(left.deadline, right.deadline),
        right,
      });
    case "progress_asc":
      return breakTie({
        ascending: true,
        left,
        primary: left.progressPercent - right.progressPercent,
        right,
      });
    case "progress_desc":
      return breakTie({
        ascending: true,
        left,
        primary: right.progressPercent - left.progressPercent,
        right,
      });
    case "risk_desc":
      return compareByRisk({ left, right });
    default:
      return breakTie({
        ascending: false,
        left,
        primary: -compareIsoAscending(left.createdAt, right.createdAt),
        right,
      });
  }
}

function compareIsoAscending(left: string, right: string): number {
  return compareAsc(parseISO(left), parseISO(right));
}

function compareNullableAscending(left: Nullable<number>, right: Nullable<number>): number {
  if (left === right) {
    return 0;
  }
  if (left === null) {
    return 1;
  }
  if (right === null) {
    return -1;
  }
  return left - right;
}

function selectAfterCursor({
  cursor,
  items,
  sort,
}: {
  cursor: Nullable<ReadingGoalCatalogKey>;
  items: ReadingGoalListItem[];
  sort: ReadingGoalSort;
}): ReadingGoalListItem[] {
  if (cursor === null) {
    return items;
  }
  return items.filter(
    (item) => compareCatalogKeys({ left: toCatalogKey(item), right: cursor, sort }) > 0,
  );
}

function toCatalogKey(item: ReadingGoalListItem): ReadingGoalCatalogKey {
  return {
    createdAt: item.createdAt,
    daysLeft: item.daysLeft,
    deadline: item.deadline,
    id: item.id,
    progressPercent: item.progressPercent,
    riskRank: ReadingGoalRiskLevelSchema.options.indexOf(item.riskLevel),
  };
}
