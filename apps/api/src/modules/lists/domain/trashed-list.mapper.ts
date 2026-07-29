import type { TrashedListView } from "@app/shared";

import type { TrashedListRow } from "../infrastructure/lists.repository.js";

import { TRASH_RETENTION } from "../../../core/trash-retention.js";

export function toTrashedListView(list: TrashedListRow): TrashedListView {
  return {
    bookCount: list._count.items,
    deletedAt: list.deletedAt.toISOString(),
    id: list.id,
    name: list.name,
    purgeAt: TRASH_RETENTION.purgeAfter(list.deletedAt).toISOString(),
  };
}
