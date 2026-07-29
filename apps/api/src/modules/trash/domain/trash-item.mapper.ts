import type { TrashItemView } from "@app/shared";

import { TrashEntityTypeSchema } from "@app/shared";

import type { TrashRow } from "../infrastructure/trash.repository.js";

import { TRASH_RETENTION } from "../../../core/trash-retention.js";

export function toTrashItemView(row: TrashRow): TrashItemView {
  return {
    context: row.context,
    deletedAt: row.deletedAt.toISOString(),
    entityType: TrashEntityTypeSchema.parse(row.entityType),
    id: row.id,
    purgeAt: TRASH_RETENTION.purgeAfter(row.deletedAt).toISOString(),
    title: row.title,
  };
}
