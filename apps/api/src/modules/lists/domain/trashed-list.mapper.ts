import type { TrashedListView } from "@app/shared";

import type { TrashedListRow } from "../infrastructure/lists.repository.js";

export function toTrashedListView(list: TrashedListRow): TrashedListView {
  return {
    bookCount: list._count.items,
    deletedAt: list.deletedAt.toISOString(),
    id: list.id,
    name: list.name,
    purgeAt: list.purgeAt.toISOString(),
  };
}
