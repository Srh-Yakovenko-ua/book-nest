import type { TagView } from "@app/shared";

import type { TagModel } from "../../../generated/prisma/models.js";

export function toTagView(tag: TagModel): TagView {
  return {
    id: tag.id,
    name: tag.name,
  };
}
