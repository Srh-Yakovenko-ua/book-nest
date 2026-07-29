import type { TrashedTimelineView } from "@app/shared";

import type { TrashedTimelineRow } from "../infrastructure/timeline.repository.js";

import { TRASH_RETENTION } from "../../../core/trash-retention.js";

export function toTrashedTimelineView(timeline: TrashedTimelineRow): TrashedTimelineView {
  return {
    bookTitle: timeline.book.title,
    deletedAt: timeline.deletedAt.toISOString(),
    eventCount: timeline._count.events,
    id: timeline.id,
    name: timeline.name,
    purgeAt: TRASH_RETENTION.purgeAfter(timeline.deletedAt).toISOString(),
  };
}
