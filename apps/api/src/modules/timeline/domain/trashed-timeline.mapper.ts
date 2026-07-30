import type { TrashedTimelineView } from "@app/shared";

import type { TrashedTimelineRow } from "../infrastructure/timeline.repository.js";

export function toTrashedTimelineView(timeline: TrashedTimelineRow): TrashedTimelineView {
  return {
    bookTitle: timeline.book.title,
    deletedAt: timeline.deletedAt.toISOString(),
    eventCount: timeline._count.events,
    id: timeline.id,
    name: timeline.name,
    purgeAt: timeline.purgeAt.toISOString(),
  };
}
