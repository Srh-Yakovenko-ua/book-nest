import type { TimelineEventSort } from "@app/shared";

import type { Prisma } from "../../../generated/prisma/client.js";

const SORT_ORDER_BY: Record<TimelineEventSort, Prisma.BookTimelineEventOrderByWithRelationInput[]> =
  {
    book_order: [{ bookOrder: "asc" }, { id: "asc" }],
    importance: [{ importanceRank: "desc" }, { bookOrder: "asc" }, { id: "asc" }],
    newest: [{ createdAt: "desc" }, { id: "desc" }],
    oldest: [{ createdAt: "asc" }, { id: "asc" }],
    timeline_order: [{ timelineOrder: "asc" }, { bookOrder: "asc" }, { id: "asc" }],
  };

export function timelineEventsOrderBy(
  sort: TimelineEventSort,
): Prisma.BookTimelineEventOrderByWithRelationInput[] {
  return SORT_ORDER_BY[sort];
}
